"""Loss calculation API endpoints."""

from fastapi import APIRouter, HTTPException
from ..models.calculation import OperatingConditions, CalculationResult, CalculateRequest, CurveRequest
from ..models.device import ModuleConfigCompact, DeviceType
from ..engine.topology import InverterConfig, OperatingPoint, calculate_inverter_losses
from ..engine.curves import sweep_output_current, sweep_switching_frequency, sweep_power_factor

router = APIRouter()


def _normalize_points(pts: list) -> list:
    """Normalize points to [(current, energy), ...] regardless of input format.

    Accepts: [{current: x, energy: y}, ...], [[x, y], ...], or Pydantic SwitchingPoint objects.
    """
    result = []
    for p in pts:
        if hasattr(p, 'current') and hasattr(p, 'energy'):
            result.append((float(p.current), float(p.energy)))
        elif isinstance(p, dict):
            result.append((p.get("current", 0), p.get("energy", 0)))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            result.append((float(p[0]), float(p[1])))
    return result


def _build_config(compact: ModuleConfigCompact) -> InverterConfig:
    """Convert frontend ModuleConfigCompact to engine InverterConfig."""
    is_sic = compact.device_type in (DeviceType.SIC_MODULE, DeviceType.SIC_DISCRETE)

    if is_sic and compact.sic_mos:
        mos = compact.sic_mos
        eon_pts = _normalize_points(mos.eon_curve.points)
        eoff_pts = _normalize_points(mos.eoff_curve.points)
        diode = compact.sic_diode if compact.sic_diode else compact.diode
        err_pts = []
        if diode and diode.err_curve:
            err_pts = _normalize_points(diode.err_curve.points)

        return InverterConfig(
            is_sic=True,
            vce_sat_25=0.0, vce_sat_125=0.0, ic_nom=mos.id_nom, vce_rated=mos.vds_rated,
            rds_on_25=mos.rds_on_25, rds_on_125=mos.rds_on_125,
            vsd_25=diode.vsd_25 if diode else 0.0,
            vsd_125=diode.vsd_125 if diode else 0.0,
            eon_points=eon_pts, eoff_points=eoff_pts, err_points=err_pts,
            eon_vcc_ref=mos.eon_curve.vcc, eoff_vcc_ref=mos.eoff_curve.vcc,
            eon_rg_ref=mos.eon_curve.rg, eoff_rg_ref=mos.eoff_curve.rg,
            rg_int=mos.rg_int or 0.0,
            vf_25=0.0, vf_125=0.0,
            rth_jc_igbt=mos.thermal.rth_jc,
            rth_jc_diode=diode.thermal.rth_jc if diode else mos.thermal.rth_jc,
            rth_ch=compact.rth_ch_module or 0.05,
            rth_ha=compact.rth_ha or 0.5,
            t_j_max=compact.t_j_max,
        )

    # IGBT
    igbt = compact.igbt
    if not igbt:
        raise HTTPException(status_code=400, detail="IGBT parameters required")

    eon_pts = _normalize_points(igbt.eon_curve.points)
    eoff_pts = _normalize_points(igbt.eoff_curve.points)
    diode = compact.diode
    err_pts = []
    if diode and diode.err_curve.points:
        err_pts = _normalize_points(diode.err_curve.points)

    brake_vce_25 = compact.brake_igbt.vce_sat_25 if compact.brake_igbt else 0.0
    brake_vce_125 = compact.brake_igbt.vce_sat_125 if compact.brake_igbt else 0.0
    brake_vf_25 = compact.brake_diode.vf_25 if compact.brake_diode else 0.0
    brake_vf_125 = compact.brake_diode.vf_125 if compact.brake_diode else 0.0
    brake_rth_igbt = compact.brake_igbt.thermal.rth_jc if compact.brake_igbt else 0.0
    brake_rth_diode = compact.brake_diode.thermal.rth_jc if compact.brake_diode else 0.0

    return InverterConfig(
        vce_sat_25=igbt.vce_sat_25, vce_sat_125=igbt.vce_sat_125,
        ic_nom=igbt.ic_nom, vce_rated=igbt.vce_rated,
        eon_points=eon_pts, eoff_points=eoff_pts, err_points=err_pts,
        eon_vcc_ref=igbt.eon_curve.vcc, eoff_vcc_ref=igbt.eoff_curve.vcc,
        eon_rg_ref=igbt.eon_curve.rg, eoff_rg_ref=igbt.eoff_curve.rg,
        rg_int=igbt.rg_int or 0.0,
        vf_25=diode.vf_25 if diode else 0.0,
        vf_125=diode.vf_125 if diode else 0.0,
        rth_jc_igbt=igbt.thermal.rth_jc,
        rth_jc_diode=diode.thermal.rth_jc if diode else igbt.thermal.rth_jc,
        rth_ch=compact.rth_ch_module or 0.05,
        rth_ha=compact.rth_ha or 0.5,
        t_j_max=compact.t_j_max,
        has_brake=compact.brake_igbt is not None,
        brake_vce_sat_25=brake_vce_25, brake_vce_sat_125=brake_vce_125,
        brake_vf_25=brake_vf_25, brake_vf_125=brake_vf_125,
        brake_rth_jc_igbt=brake_rth_igbt,
        brake_rth_jc_diode=brake_rth_diode,
    )


@router.post("/calculate", response_model=CalculationResult)
async def calculate_losses(req: CalculateRequest):
    """
    Calculate losses for a three-phase two-level inverter.
    Returns complete loss breakdown with thermal iteration and calculation steps.
    """
    try:
        config = req.config
        conditions = req.conditions
        eng_config = _build_config(config)
        op = OperatingPoint(
            vdc=conditions.vdc,
            i_out_rms=conditions.i_out_rms,
            f_out=conditions.f_out,
            f_sw=conditions.f_sw,
            m=conditions.modulation_index,
            cos_phi=conditions.power_factor,
            modulation=conditions.modulation if hasattr(conditions, 'modulation') else 'spwm',
            t_ambient=conditions.t_ambient,
        )
        result = calculate_inverter_losses(eng_config, op, include_steps=True)

        return CalculationResult(
            device_type=config.device_type,
            module_name=config.module_name,
            conditions=conditions,
            p_total_loss=result["p_total_loss"],
            p_igbt_cond=result["p_igbt_cond"],
            p_igbt_sw=result["p_igbt_sw"],
            p_diode_cond=result["p_diode_cond"],
            p_diode_sw=result["p_diode_sw"],
            p_brake_loss=result["p_brake_loss"],
            efficiency=result["efficiency"],
            p_out=result["p_out"],
            t_j_max=result["t_j_max"],
            t_j_max_device=result["t_j_max_device"],
            t_case_est=result["t_case_est"],
            t_heatsink_est=result["t_heatsink_est"],
            devices=result["devices"],
            iteration_count=result["iteration_count"],
            converged=result["converged"],
            calculation_steps=result["calculation_steps"],
            per_leg=result.get("per_leg"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate/curve")
async def calculate_curve(req: CurveRequest):
    """Generate characteristic curves via parametric sweep."""
    try:
        config = req.config
        conditions = req.conditions
        eng_config = _build_config(config)
        base_op = OperatingPoint(
            vdc=conditions.vdc,
            i_out_rms=conditions.i_out_rms,
            f_out=conditions.f_out,
            f_sw=conditions.f_sw,
            m=conditions.modulation_index,
            cos_phi=conditions.power_factor,
            t_ambient=conditions.t_ambient,
        )

        if req.sweep_param == "i_out":
            result = sweep_output_current(eng_config, base_op,
                                          i_min=req.sweep_start, i_max=req.sweep_end,
                                          n_points=req.sweep_points)
        elif req.sweep_param == "f_sw":
            result = sweep_switching_frequency(eng_config, base_op,
                                               f_min=req.sweep_start, f_max=req.sweep_end,
                                               n_points=req.sweep_points)
        elif req.sweep_param == "cos_phi":
            result = sweep_power_factor(eng_config, base_op, n_points=req.sweep_points)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown sweep param: {req.sweep_param}")

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
