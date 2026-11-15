"""Versioned TA20 calculation and display catalog. Numbers remain server-owned."""
import hashlib
import json
import math

CATALOG_VERSION = "ta20-1"
NAMES = ('SMA','EMA','MACD','PSAR','CCI','STOCH','RSI','STOCHRSI','WILLIAMS_R','AO','TSI','UO','TRIX','BBANDS','KELTNER','DONCHIAN','OBV','PVT','AD','CMF')
DEFAULTS = {
 'SMA': {'timeperiod':20}, 'EMA': {'timeperiod':20},
 'MACD': {'fastperiod':12,'slowperiod':26,'signalperiod':9},
 'PSAR': {'acceleration':0.02,'maximum':0.2}, 'CCI': {'timeperiod':20},
 'STOCH': {'fastk_period':14,'slowk_period':3,'slowd_period':3},
 'RSI': {'timeperiod':14},
 'STOCHRSI': {'rsi_period':14,'stoch_period':14,'k_period':3,'d_period':3},
 'WILLIAMS_R': {'timeperiod':14}, 'AO': {'fastperiod':5,'slowperiod':34},
 'TSI': {'long_period':25,'short_period':13,'signal_period':0},
 'UO': {'timeperiod1':7,'timeperiod2':14,'timeperiod3':28},
 'TRIX': {'timeperiod':15,'signal_period':0},
 'BBANDS': {'timeperiod':20,'nbdevup':2.0,'nbdevdn':2.0,'matype':0},
 'KELTNER': {'timeperiod':20,'atr_period':10,'multiplier':2.0},
 'DONCHIAN': {'timeperiod':20}, 'OBV':{}, 'PVT':{}, 'AD':{}, 'CMF':{'timeperiod':20},
}
OVERLAYS = {'SMA','EMA','PSAR','BBANDS','KELTNER','DONCHIAN'}
CUMULATIVE = {'OBV','PVT','AD'}
KEYS = {'SMA':['sma'],'EMA':['ema'],'MACD':['macd','signal','histogram'],'PSAR':['sar'],
 'CCI':['cci'],'STOCH':['slow_k','slow_d'],'RSI':['rsi'],'STOCHRSI':['k','d'],
 'WILLIAMS_R':['williams_r'],'AO':['ao'],'TSI':['tsi','signal'],'UO':['uo'],
 'TRIX':['trix','signal'],'BBANDS':['upper','middle','lower'],'KELTNER':['upper','middle','lower'],
 'DONCHIAN':['upper','middle','lower'],'OBV':['obv'],'PVT':['pvt'],'AD':['ad'],'CMF':['cmf']}


def parameter_spec(name, key, default):
    if key == 'matype':
        return {'default':default,'min':0,'max':8,'type':'integer'}
    if key in {'acceleration','maximum'}:
        return {'default':default,'min':0.0001,'max':1,'type':'number'}
    if key in {'nbdevup','nbdevdn','multiplier'}:
        return {'default':default,'min':0.01,'max':20,'type':'number'}
    return {'default':default,'min':0 if key == 'signal_period' else 2,'max':200,'type':'integer'}


def normalize_parameters(name, supplied=None, show_signal=False):
    if name not in DEFAULTS:
        raise ValueError('Unsupported indicator: ' + name)
    supplied = dict(supplied or {})
    if set(supplied) - set(DEFAULTS[name]):
        raise ValueError('Unknown parameters for ' + name)
    values = {**DEFAULTS[name], **supplied}
    if show_signal and name in {'TSI','TRIX'} and not values['signal_period']:
        values['signal_period'] = 9
    for key, value in values.items():
        spec = parameter_spec(name,key,DEFAULTS[name][key])
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
            raise ValueError(name + '.' + key + ' must be finite numeric')
        if spec['type']=='integer' and int(value)!=value:
            raise ValueError(name + '.' + key + ' must be integer')
        if not spec['min'] <= value <= spec['max'] or key == 'signal_period' and value == 1:
            raise ValueError(name + '.' + key + ' out of range')
        if spec['type']=='integer':
            values[key]=int(value)
    if name in {'MACD','AO'} and values['fastperiod'] >= values['slowperiod']:
        raise ValueError('fastperiod must be less than slowperiod')
    if name=='PSAR' and values['acceleration'] > values['maximum']:
        raise ValueError('acceleration must not exceed maximum')
    if name=='UO' and not values['timeperiod1'] < values['timeperiod2'] < values['timeperiod3']:
        raise ValueError('UO periods must be increasing')
    return values


def instance_id(name, parameters):
    key=json.dumps([name,parameters],sort_keys=True,separators=(',',':'))
    return name.lower()+'-'+hashlib.sha256(key.encode()).hexdigest()[:12]


def descriptors(name, parameters=None):
    unit = 'price' if name in OVERLAYS|{'MACD','AO'} else 'volume' if name=='OBV' else 'volume_weighted' if name in {'PVT','AD'} else 'ratio' if name=='CMF' else 'percent' if name in {'RSI','STOCH','STOCHRSI','WILLIAMS_R','TSI','UO','TRIX'} else 'index'
    keys = KEYS[name]
    if name in {'TSI','TRIX'} and not (parameters or {}).get('signal_period',0):
        keys=keys[:1]
    return [{'key':key,'label':key,'unit':unit,
             'display':'markers' if name=='PSAR' else 'histogram' if key=='histogram' or name=='AO' else 'line',
             **({'shape':'circle'} if name=='PSAR' else {}),
             **({'role':key,'bandGroup':name} if name in {'BBANDS','KELTNER','DONCHIAN'} else {})} for key in keys]


def catalog():
    return {'schemaVersion':2,'catalogVersion':CATALOG_VERSION,'maxInstances':40,'maxVisiblePanels':4,
            'defaultInstances':[{'name':name,'parameters':DEFAULTS[name]} for name in ('SMA','RSI','MACD')],
            'indicators':[{'name':name,'label':name,'defaults':DEFAULTS[name],
                'parameters':{key:parameter_spec(name,key,value) for key,value in DEFAULTS[name].items()},
                'supportsSignal':name in {'TSI','TRIX'},'panel':'price' if name in OVERLAYS else 'oscillator',
                'series':descriptors(name,{'signal_period':9})} for name in NAMES]}
