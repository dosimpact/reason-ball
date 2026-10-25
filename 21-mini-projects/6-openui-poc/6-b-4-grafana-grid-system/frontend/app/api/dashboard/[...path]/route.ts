import {relayDashboard} from '@/shared/api';
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){return relayDashboard(request,(await params).path);}
export async function POST(request:Request,{params}:{params:Promise<{path:string[]}>}){return relayDashboard(request,(await params).path);}
