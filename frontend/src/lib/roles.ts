export function isAdmin(role?: string): boolean {
  return role === 'admin';
}

export function isCommercial(role?: string): boolean {
  return role === 'commercial';
}

/** Admin ou commercial — accès gestion (sauf utilisateurs et dashboard analytique admin) */
export function isManager(role?: string): boolean {
  return role === 'admin' || role === 'commercial';
}

export function homeRouteForRole(role?: string): string {
  return role === 'commercial' ? '/invoices' : '/dashboard';
}
