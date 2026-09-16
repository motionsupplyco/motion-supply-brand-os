const bounded=(value,max)=>String(value??'').slice(0,max);

export function safeRequestRoute(req){
  const routePath=typeof req?.route?.path==='string'?req.route.path:null;
  if(routePath){
    const base=typeof req?.baseUrl==='string'?req.baseUrl:'';
    return bounded(`${base}${routePath}`||'/',300);
  }
  return String(req?.path||'').startsWith('/api')?'/api/:unmatched':'/';
}

export function structuredRequestRecord({req,res,requestId,startedAt,finishedAt=Date.now()}){
  const status=Number(res?.statusCode)||0;
  return {
    timestamp:new Date(finishedAt).toISOString(),
    level:status>=500?'error':status>=400?'warn':'info',
    event:'http_request',
    request_id:bounded(requestId||res?.locals?.requestId||res?.getHeader?.('X-Request-Id')||'',128),
    method:bounded(req?.method||'UNKNOWN',12).toUpperCase(),
    route:safeRequestRoute(req),
    status,
    duration_ms:Math.max(0,Math.round(finishedAt-Number(startedAt||finishedAt)))
  };
}

export function structuredRequestLogger({logger=console,clock=Date.now}={}){
  return (req,res,next)=>{
    const startedAt=clock();
    res.on('finish',()=>{
      if(!String(req?.path||'').startsWith('/api'))return;
      const record=structuredRequestRecord({req,res,requestId:res?.locals?.requestId,startedAt,finishedAt:clock()});
      const line=JSON.stringify(record);
      if(record.level==='error')logger.error(line);
      else if(record.level==='warn')logger.warn(line);
      else logger.log(line);
    });
    next();
  };
}
