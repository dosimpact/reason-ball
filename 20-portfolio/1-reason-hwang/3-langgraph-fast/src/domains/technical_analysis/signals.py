"""Descriptive indicator states. Crosses require two valid bars; never trade advice."""


def cross(previous,current):
    if previous is None or current is None:
        return '판단 불가'
    if previous<=0<current:
        return '상향 교차'
    if previous>=0>current:
        return '하향 교차'
    return '교차 없음'


def signal(name,series,closes):
    def at(key,index=-1):
        values=series.get(key,())
        return values[index] if len(values)>=abs(index) else None
    def relative(left,right):
        now=None if left[-1] is None or right[-1] is None else left[-1]-right[-1]
        prev=None if left[-2] is None or right[-2] is None else left[-2]-right[-2]
        return {'state':'판단 불가' if now is None else '위' if now>0 else '아래' if now<0 else '같음','cross':cross(prev,now)}
    def pair(key):
        return [at(key,-2),at(key)]
    def band(value,low,high):
        return '판단 불가' if value is None else '상단 범위' if value>=high else '하단 범위' if value<=low else '중간 범위'
    primary=next(iter(series),None)
    value=at(primary) if primary else None
    if name in {'EMA','PSAR'}:
        prices=[closes[-2] if len(closes)>1 else None,closes[-1] if closes else None]
        result=relative(prices,pair('ema' if name=='EMA' else 'sar'))
    elif name in {'STOCH','STOCHRSI'}:
        key,dkey=('slow_k','slow_d') if name=='STOCH' else ('k','d')
        result=relative(pair(key),pair(dkey))
        result.update(range=band(at(key),20,80),lower=20,upper=80)
    elif name in {'CCI','WILLIAMS_R','UO'}:
        key,low,high={'CCI':('cci',-100,100),'WILLIAMS_R':('williams_r',-80,-20),'UO':('uo',30,70)}[name]
        result={'state':band(at(key),low,high),'lower':low,'upper':high}
    elif name in {'BBANDS','KELTNER','DONCHIAN'}:
        upper,lower=at('upper'),at('lower')
        close=closes[-1] if closes else None
        result={'state':'판단 불가' if upper is None or lower is None or close is None else '상단 밖' if close>upper else '하단 밖' if close<lower else '밴드 안'}
        if name=='DONCHIAN':
            pu,pl=at('upper',-2),at('lower',-2)
            ppu,ppl=at('upper',-3),at('lower',-3)
            previous=closes[-2] if len(closes)>1 else None
            result['cross']='판단 불가' if None in (pu,pl,ppu,ppl,previous,close) else '상단 돌파' if previous<=ppu and close>pu else '하단 돌파' if previous>=ppl and close<pl else '돌파 없음'
    elif name in {'AO','TSI','TRIX','CMF'}:
        key=name.lower()
        values=pair(key)
        result={'state':'판단 불가' if values[-1] is None else '양수' if values[-1]>0 else '음수' if values[-1]<0 else '0','cross':cross(values[0],values[1])}
        if 'signal' in series:
            other=relative(values,pair('signal'))
            result.update(signalPosition=other['state'],signalCross=other['cross'])
    else:  # OBV/PVT/AD: changes relative to declared cumulative origin only.
        previous=at(primary,-2) if primary else None
        result={'state':'판단 불가' if value is None or previous is None else '증가' if value>previous else '감소' if value<previous else '변화 없음'}
    if value is not None:
        result['latest']=value
    return result
