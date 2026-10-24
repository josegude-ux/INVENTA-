/**
 * INVENTA role permissions (client mirror of intended RLS).
 * Server/RLS remains authoritative; this only drives UI gating in demo/local mode.
 * Roles: operario | supervisor | administrador
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InventaRoles = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROLES = Object.freeze(['operario', 'supervisor', 'administrador']);

  function normalizeRole(role) {
    const r = String(role || '').toLowerCase().trim();
    if (r === 'admin' || r === 'administrador (demo)') return 'administrador';
    if (r === 'supervisor (demo)') return 'supervisor';
    if (r === 'operator' || r === 'operario 1' || r === 'operario 2') return 'operario';
    if (ROLES.includes(r)) return r;
    return null;
  }

  function isStaff(role) {
    const r = normalizeRole(role);
    return r === 'supervisor' || r === 'administrador';
  }

  /** Consulta during active campaign: blocked for operario, allowed for staff. */
  function canConsultDuringCampaign(role, campaignActive) {
    if (!campaignActive) return normalizeRole(role) !== null;
    return isStaff(role);
  }

  /** Theoretical BC quantities: never for operario while campaign active. */
  function canSeeTheoretical(role, campaignActive) {
    if (!campaignActive) return isStaff(role);
    return isStaff(role);
  }

  function canManageWarehouse(role) {
    return isStaff(role);
  }

  function canAdministerUsers(role) {
    return normalizeRole(role) === 'administrador';
  }

  function canOpenCloseCampaign(role) {
    return normalizeRole(role) === 'administrador';
  }

  function canResolveIncidents(role) {
    return isStaff(role);
  }

  /** Pair counting: one device, one result, two named workers — never two independent tallies. */
  function pairSessionRules() {
    return Object.freeze({
      oneDevice: true,
      oneResult: true,
      identifyBothAtStart: true,
      allowHandoff: true,
      noDoubleConfirmPerArticle: true,
    });
  }

  return {
    ROLES,
    normalizeRole,
    isStaff,
    canConsultDuringCampaign,
    canSeeTheoretical,
    canManageWarehouse,
    canAdministerUsers,
    canOpenCloseCampaign,
    canResolveIncidents,
    pairSessionRules,
  };
});
