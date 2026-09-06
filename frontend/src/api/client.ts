const RAW_BASE = (import.meta as any).env?.VITE_API_URL || (import.meta.env.PROD ? 'https://dealflow360-ycs6.onrender.com' : '');
const BASE_URL = RAW_BASE ? (RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE.replace(/\/$/, '')}/api`) : '/api';

export class ApiClient {
  private static refreshing: Promise<string | null> | null = null;
  static setTokens(access: string, refresh: string) { sessionStorage.setItem('access_token', access); sessionStorage.setItem('refresh_token', refresh); }
  static clearTokens() { for (const storage of [localStorage,sessionStorage]) { storage.removeItem('access_token');storage.removeItem('refresh_token'); } }
  private static async refresh(): Promise<string | null> {
    if (!this.refreshing) this.refreshing = (async () => {
      const token = sessionStorage.getItem('refresh_token');
      if (!token) return null;
      const response = await fetch(`${BASE_URL}/auth/refresh/`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh:token})});
      if (!response.ok) return null;
      const data = await response.json(); this.setTokens(data.access,data.refresh || token);return data.access;
    })().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  private static async request(endpoint: string, options: RequestInit = {}) {
    const publicPortal = endpoint.startsWith('/portal/quotations/') && endpoint !== '/portal/quotations/';
    const headers: Record<string,string> = {'Content-Type':'application/json',...(options.headers as Record<string,string> || {})};
    const token = sessionStorage.getItem('access_token');
    if (token && !publicPortal) headers.Authorization = `Bearer ${token}`;
    let response = await fetch(BASE_URL+endpoint,{...options,headers});
    if (response.status===401 && token && !publicPortal && !endpoint.startsWith('/auth/login')) {
      const access = await this.refresh();
      if (access) { headers.Authorization=`Bearer ${access}`; response=await fetch(BASE_URL+endpoint,{...options,headers}); }
      else { this.clearTokens();window.location.assign('/login'); }
    }
    if (!response.ok) throw await response.json().catch(()=>({detail:`Request failed (${response.status}). Please try again.`}));
    return response;
  }
  static async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await this.request(endpoint,options);
    return response.status === 204 ? undefined as T : response.json();
  }
  static async download(endpoint: string) { return (await this.request(endpoint)).blob(); }
  static get<T>(endpoint: string) { return this.fetch<T>(endpoint); }
  static post<T>(endpoint:string,body?:unknown) {return this.fetch<T>(endpoint,{method:'POST',body:body===undefined?undefined:JSON.stringify(body)});}
  static put<T>(endpoint:string,body?:unknown) {return this.fetch<T>(endpoint,{method:'PUT',body:JSON.stringify(body)});}
  static patch<T>(endpoint:string,body?:unknown) {return this.fetch<T>(endpoint,{method:'PATCH',body:JSON.stringify(body)});}
  static delete<T>(endpoint:string) {return this.fetch<T>(endpoint,{method:'DELETE'});}
}
export function setTokens(access:string,refresh:string){ApiClient.setTokens(access,refresh);}
export function clearTokens(){ApiClient.clearTokens();}
export function isAuthenticated(){return !!sessionStorage.getItem('access_token');}
export function apiClient<T=unknown>(endpoint:string, options:RequestInit & {params?:Record<string,string>}={}) {
  const {params,...init}=options; const query=params?new URLSearchParams(params).toString():'';
  return ApiClient.fetch<T>(endpoint+(query?(endpoint.includes('?')?'&':'?')+query:''),init);
}
