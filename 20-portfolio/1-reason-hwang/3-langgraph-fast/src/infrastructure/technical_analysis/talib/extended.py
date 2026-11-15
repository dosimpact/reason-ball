"""TA20 additions. Explicit formula choices; no external model calculations."""
import numpy as np
import talib

from domains.technical_analysis.catalog import normalize_parameters
from infrastructure.technical_analysis.talib._types import RawIndicatorResult


def ema(values, period):
    """SMA seed on a contiguous finite run, then alpha=2/(period+1)."""
    result=np.full(len(values),np.nan)
    seed=[]
    previous=None
    for index,value in enumerate(values):
        if not np.isfinite(value):
            seed=[]
            previous=None
            continue
        if previous is None:
            seed.append(value)
            if len(seed)<period:
                continue
            previous=float(np.mean(seed[-period:]))
        else:
            previous += 2/(period+1)*(value-previous)
        result[index]=previous
    return result


def divide(numerator, denominator):
    return np.divide(numerator,denominator,out=np.full_like(numerator,np.nan,dtype=float),where=np.isfinite(denominator)&(denominator!=0))


def calculate(name, a, supplied):
    p=normalize_parameters(name,supplied)
    c,h,l,v=a.close,a.high,a.low,a.volume
    n=int(p.get('timeperiod',14))
    if name=='PSAR':
        outputs={'sar':talib.SAR(h,l,acceleration=p['acceleration'],maximum=p['maximum'])}
    elif name=='CCI':
        values=talib.CCI(h,l,c,timeperiod=n)
        values[talib.STDDEV((h+l+c)/3,timeperiod=n)==0]=np.nan
        outputs={'cci':values}
    elif name=='STOCH':
        high=talib.MAX(h,timeperiod=p['fastk_period']); low=talib.MIN(l,timeperiod=p['fastk_period'])
        raw=100*divide(c-low,high-low)
        k=rolling_mean(raw,p['slowk_period']); d=rolling_mean(k,p['slowd_period'])
        outputs={'slow_k':k,'slow_d':d}
    elif name=='STOCHRSI':
        rsi=talib.RSI(c,timeperiod=p['rsi_period'])
        low=talib.MIN(rsi,timeperiod=p['stoch_period']); high=talib.MAX(rsi,timeperiod=p['stoch_period'])
        raw=100*divide(rsi-low,high-low)
        # rolling mean requires every point in its window; nulls remain gaps.
        k=rolling_mean(raw,p['k_period']); d=rolling_mean(k,p['d_period'])
        outputs={'k':k,'d':d}
    elif name=='WILLIAMS_R':
        high=talib.MAX(h,timeperiod=n); low=talib.MIN(l,timeperiod=n)
        outputs={'williams_r':-100*divide(high-c,high-low)}
    elif name=='AO':
        median=(h+l)/2
        outputs={'ao':talib.SMA(median,timeperiod=p['fastperiod'])-talib.SMA(median,timeperiod=p['slowperiod'])}
    elif name=='TSI':
        delta=np.r_[np.nan,np.diff(c)]
        numerator=ema(ema(delta,p['long_period']),p['short_period'])
        denominator=ema(ema(np.abs(delta),p['long_period']),p['short_period'])
        values=100*divide(numerator,denominator)
        outputs={'tsi':values}
        if p['signal_period']:
            outputs['signal']=ema(values,p['signal_period'])
    elif name=='UO':
        prev=np.r_[np.nan,c[:-1]]
        low=np.minimum(l,prev); high=np.maximum(h,prev)
        bp=c-low; tr=high-low
        ratios=[divide(rolling_sum(bp,p[key]),rolling_sum(tr,p[key])) for key in ('timeperiod1','timeperiod2','timeperiod3')]
        outputs={'uo':100*(4*ratios[0]+2*ratios[1]+ratios[2])/7}
    elif name=='TRIX':
        values=talib.TRIX(c,timeperiod=n)
        outputs={'trix':values}
        if p['signal_period']:
            outputs['signal']=ema(values,p['signal_period'])
    elif name=='KELTNER':
        middle=talib.EMA(c,timeperiod=n)
        width=p['multiplier']*talib.ATR(h,l,c,timeperiod=p['atr_period'])
        outputs={'upper':middle+width,'middle':middle,'lower':middle-width}
    elif name=='DONCHIAN':
        upper=talib.MAX(h,timeperiod=n); lower=talib.MIN(l,timeperiod=n)
        outputs={'upper':upper,'middle':(upper+lower)/2,'lower':lower}
    elif name=='PVT':
        out=np.full(len(c),np.nan); out[0]=0
        for i in range(1,len(c)):
            if c[i-1]!=0 and np.isfinite(out[i-1]):
                out[i]=out[i-1]+v[i]*(c[i]-c[i-1])/c[i-1]
        outputs={'pvt':out}
    elif name in {'AD','CMF'}:
        multiplier=np.divide(2*c-h-l,h-l,out=np.zeros_like(c),where=h!=l)
        flow=multiplier*v
        outputs={'ad':np.cumsum(flow)} if name=='AD' else {'cmf':divide(rolling_sum(flow,n),rolling_sum(v,n))}
    else:
        raise ValueError('Unknown extended indicator')
    return RawIndicatorResult(parameters=p,outputs=outputs)


def rolling_sum(values, period):
    out=np.full(len(values),np.nan)
    for i in range(period-1,len(values)):
        window=values[i-period+1:i+1]
        if np.all(np.isfinite(window)):
            out[i]=float(np.sum(window))
    return out


def rolling_mean(values, period):
    return rolling_sum(values,period)/period
