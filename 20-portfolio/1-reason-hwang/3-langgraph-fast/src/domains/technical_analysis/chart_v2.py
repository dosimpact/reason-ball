"""Aligned multi-instance snapshot; every numeric value comes from the engine."""
from domains.technical_analysis.catalog import CATALOG_VERSION, OVERLAYS, descriptors, instance_id
from domains.technical_analysis.report import indicator_signal


def build_v2(prices,metadata,settings,count,result):
    display=prices[-count:]
    bars=[{'time':p.trading_date.isoformat(),'open':float(p.open),'high':float(p.high),'low':float(p.low),'close':float(p.close),'volume':p.volume} for p in display]
    items=[]
    for setting,outcome in zip(settings,result.indicators,strict=True):
        parameters=setting.request().parameters
        iid=setting.instanceId or instance_id(setting.name,parameters)
        series=[]
        for descriptor in descriptors(setting.name,parameters):
            values=list(outcome.series.get(descriptor['key'], ()))
            series.append({**descriptor,'values':values[-len(bars):] if values else [None]*len(bars)})
        items.append({'instanceId':iid,'name':setting.name,'label':setting.name+'('+','.join(str(v) for v in parameters.values())+')',
            'parameters':parameters,'showSignal':bool(parameters.get('signal_period',0)),'panel':'price' if setting.name in OVERLAYS else 'oscillator',
            'status':outcome.status,'error':outcome.error_message,'errorCode':outcome.error_code,
            'signal':indicator_signal(setting.name,outcome.series,[float(p.close) for p in prices]),'series':series})
    cumulative=any(s.name in {'OBV','PVT','AD'} for s in settings)
    return {**metadata,'schemaVersion':2,'catalogVersion':CATALOG_VERSION,'as_of':bars[-1]['time'],
        'bars':bars,'indicators':items,'warnings':list(result.warnings),
        'requested_count':count,'available_count':len(prices),
        'origin':{'date':prices[0].trading_date.isoformat(),'availableHistory':len(prices),
          'policy':'calendar-2000-01-01-first-available-v1' if cumulative else 'warmup-history-v1',
          'requestedDate':'2000-01-01' if cumulative else None,
          'baseline':{'OBV':'first-volume','PVT':'zero','AD':'first-money-flow-volume'} if cumulative else None}}
