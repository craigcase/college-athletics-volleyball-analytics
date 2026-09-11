import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicSupabaseConfigured, requirePublicSupabaseConfig } from './config';

export async function updateSession(request:NextRequest){
  if(!publicSupabaseConfigured())return NextResponse.next({request});
  const {url,publishableKey}=requirePublicSupabaseConfig();
  let response=NextResponse.next({request});
  const supabase=createServerClient(url,publishableKey,{cookies:{
    getAll(){return request.cookies.getAll();},
    setAll(cookiesToSet, headers){
      cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      Object.entries(headers ?? {}).forEach(([key,value])=>response.headers.set(key,String(value)));
    },
  }});
  await supabase.auth.getClaims();
  return response;
}
