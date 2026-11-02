/** Usuario autenticado, armado a partir de los claims del token. */
export interface Principal {
  oid: string;
  sub?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  scopes: string[];
}
