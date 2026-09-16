const UUID_SEGMENT=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_OPAQUE_SEGMENT=/^[A-Za-z0-9_-]{48,}$/;

const bounded=(value,max)=>String(value??'').slice(0,max);

export function safeRequestPath(req){
  const routePath=typeof req?.route?.path==='string'?req.route.path:req?.path;
  const raw=bounded(routePath||'/',300);
  return raw.split('/').map(segment=>{
    if(UUID_SEGMENT.test(segment))return ':id';
    if(LONG_OPAQUE_SEGMENT.test(segment))return ':opaque';
    return segment;
  }).join('/');
}

export function structuredRequestRecord({req,res,requestId,startedAt,finishedAt=Date.now()}){
  const status=Number(res?.statusCode)||0;
  return {
    timestamp:new Date(finishedAt).toISOString(),
    level:status>=500?'error':status>=400?'warn':'info',
    event:'http_request',
    request_id:bounded(requestId||res?.getHeader?.('X-Request-Id')||'',128),
    method:bounded(req?.method||'UNKNOWN',12).toUpperCase(),
    path:safeRequestPath(req),
    status,
    duration_ms:Math.max(0,Math.round(finishedAt-Number(startedAt||finishedAt)))
  };
}

export function structuredRequestLogger({logger=console,clock=Date.now}={}){
  return (req,res,next)=>{
    const startedAt=clock();
    res.on('finish',()=>{
      if(!String(req.path||'').startsWith('/api/'))return;
      const record=structuredRequestRecord({req,res,requestId:res.locals?.requestId,startedAt,finishedAt:clock()});
      const line=JSON.stringify(record);
      if(record.level==='error')logger.error(line);
      else if(record.level==='warn')logger.warn(line);
      else logger.log(line);
    });
    next();
  };
}
