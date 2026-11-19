"""Independent small-number formula fixtures and public catalog invariants."""
import numpy as np
import pytest

from domains.technical_analysis.catalog import NAMES, catalog, instance_id, normalize_parameters
from domains.technical_analysis.report import AgentIndicator
from infrastructure.technical_analysis.talib._types import PriceArrays
from infrastructure.technical_analysis.talib.extended import calculate


def arrays(close, high=None, low=None, volume=None):
    c=np.asarray(close,dtype=float)
    return PriceArrays(c,c+1 if high is None else np.asarray(high,dtype=float),c-1 if low is None else np.asarray(low,dtype=float),c,np.ones(len(c)) if volume is None else np.asarray(volume,dtype=float))


def test_ao_linear_ramp_difference_of_window_midpoints():
    actual=calculate('AO',arrays(range(1,41)),{}).outputs['ao']
    assert np.all(np.isnan(actual[:33]))
    np.testing.assert_allclose(actual[33:],14.5)


def test_pvt_hand_calculated_percentage_volume_accumulation():
    actual=calculate('PVT',arrays([10,12,9],volume=[100,200,300]),{}).outputs['pvt']
    np.testing.assert_allclose(actual,[0,40,-35])


def test_ad_and_cmf_hand_calculated_money_flow_and_zero_volume():
    a=arrays([11,10],high=[12,13],low=[8,9],volume=[100,200])
    np.testing.assert_allclose(calculate('AD',a,{}).outputs['ad'],[50,-50])
    cmf=calculate('CMF',a,{'timeperiod':2}).outputs['cmf']
    assert np.isnan(cmf[0])
    assert cmf[1]==pytest.approx(-1/6)
    flat=arrays([10,10],high=[10,10],low=[10,10],volume=[0,0])
    np.testing.assert_allclose(calculate('AD',flat,{}).outputs['ad'],[0,0])
    assert np.all(np.isnan(calculate('CMF',flat,{'timeperiod':2}).outputs['cmf']))


def test_donchian_includes_current_window_and_not_future_bars():
    out=calculate('DONCHIAN',arrays([1,2,2,4],high=[2,4,3,6],low=[0,1,2,3]),{'timeperiod':3}).outputs
    np.testing.assert_allclose(out['upper'][2:],[4,6])
    np.testing.assert_allclose(out['lower'][2:],[0,1])
    np.testing.assert_allclose(out['middle'][2:],[2,3.5])
    assert np.isnan(out['upper'][1])


def test_stochrsi_hand_derived_alternating_rsi_and_smoothing():
    # Wilder RSI2: 50,75,37.5,68.75,34.375,67.1875. Its 2-bar
    # stochastic alternates 100/0, so SMA2 K and SMA2 D both become 50.
    out=calculate('STOCHRSI',arrays([1,2,1,2,1,2,1,2]),{'rsi_period':2,'stoch_period':2,'k_period':2,'d_period':2}).outputs
    assert np.all(np.isnan(out['k'][:4]))
    assert np.all(np.isnan(out['d'][:5]))
    np.testing.assert_allclose(out['k'][4:],50)
    np.testing.assert_allclose(out['d'][5:],50)


def test_tsi_rising_changes_and_flat_denominator_signal_defaults():
    rising=calculate('TSI',arrays(range(1,12)),{'long_period':2,'short_period':2}).outputs
    assert list(rising)==['tsi']
    assert np.all(np.isnan(rising['tsi'][:3]))
    np.testing.assert_allclose(rising['tsi'][3:],100)
    signalled=calculate('TSI',arrays(range(1,12)),{'long_period':2,'short_period':2,'signal_period':2}).outputs
    assert np.isnan(signalled['signal'][3])
    np.testing.assert_allclose(signalled['signal'][4:],100)
    flat=calculate('TSI',arrays([5]*20),{}).outputs['tsi']
    assert np.all(np.isnan(flat))


def test_trix_exponential_growth_and_optional_signal_warmup():
    # After three EMA2 passes an exponential input still grows, and TA-Lib
    # TRIX's first defined point is index 3*(2-1)+1 = 4.
    out=calculate('TRIX',arrays([2.**i for i in range(12)]),{'timeperiod':2,'signal_period':2}).outputs
    assert np.all(np.isnan(out['trix'][:4]))
    assert np.isfinite(out['trix'][4])
    assert np.isnan(out['signal'][4]) and np.isfinite(out['signal'][5])


def test_catalog_20_stable_instances_validation_and_legacy_defaults():
    assert len(NAMES)==20 and len(catalog()['indicators'])==20
    a=normalize_parameters('SMA',{'timeperiod':20})
    assert instance_id('SMA',a)==instance_id('SMA',{'timeperiod':20})
    assert instance_id('SMA',a)!=instance_id('SMA',{'timeperiod':60})
    assert AgentIndicator(name='RSI').request().parameters=={'timeperiod':14}
    for bad in ({'timeperiod':0},{'timeperiod':2.5},{'timeperiod':True},{'unknown':20}):
        with pytest.raises(ValueError):
            normalize_parameters('SMA',bad)


@pytest.mark.parametrize('name',NAMES)
def test_every_catalog_calculator_outputs_aligned_finite_latest(name):
    from domains.technical_analysis.models import IndicatorName
    from infrastructure.technical_analysis.talib.registry import get_indicator_registration
    c=100+np.arange(1000)*0.01+np.sin(np.arange(1000)/3)*5
    a=arrays(c,volume=100+np.arange(1000))
    out=get_indicator_registration(IndicatorName(name)).calculator(a,normalize_parameters(name))
    for values in out.outputs.values():
        assert len(values)==len(c)
        assert np.isfinite(values[-1]), name


def test_flat_undefined_oscillators_stay_null_not_zero():
    a=arrays([10]*80,high=[10]*80,low=[10]*80)
    for name in ('CCI','STOCH','STOCHRSI','WILLIAMS_R','UO'):
        for values in calculate(name,a,{}).outputs.values():
            assert np.all(np.isnan(values)), name


def test_signal_boundaries_positions_and_previous_channel_breakout():
    from domains.technical_analysis.report import indicator_signal
    assert indicator_signal('EMA',{'ema':[10,10]},[10,11])['cross']=='상향 교차'
    assert indicator_signal('EMA',{'ema':[10,10]},[9,10])['cross']=='교차 없음'
    assert indicator_signal('CCI',{'cci':[90,100]},[1,1])['state']=='상단 범위'
    assert indicator_signal('WILLIAMS_R',{'williams_r':[-79,-80]},[1,1])['state']=='하단 범위'
    assert indicator_signal('UO',{'uo':[None,70]},[1,1])['state']=='상단 범위'
    assert indicator_signal('PSAR',{'sar':[None,9]},[8,10])['cross']=='판단 불가'
    stochastic=indicator_signal('STOCHRSI',{'k':[20,80],'d':[30,50]},[1,1])
    assert stochastic['range']=='상단 범위' and stochastic['cross']=='상향 교차'
    assert indicator_signal('CMF',{'cmf':[-0.1,0]},[1,1])['state']=='0'
    assert indicator_signal('AO',{'ao':[0,1]},[1,1])['cross']=='상향 교차'
    assert indicator_signal('TSI',{'tsi':[-1,1],'signal':[0,0]},[1,1])['signalCross']=='상향 교차'
    assert indicator_signal('BBANDS',{'upper':[11,11],'middle':[10,10],'lower':[9,9]},[10,11])['state']=='밴드 안'
    dc=indicator_signal('DONCHIAN',{'upper':[10,11,12],'middle':[8,9,10],'lower':[6,7,8]},[9,10,12])
    assert dc['state']=='밴드 안' and dc['cross']=='상단 돌파'
    assert indicator_signal('OBV',{'obv':[100,100]},[1,1])['state']=='변화 없음'


@pytest.mark.asyncio
@pytest.mark.parametrize('canvas',[False,True])
async def test_scripted_model_all20_tool_route_through_each_agent(canvas):
    from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
    from langchain_core.messages import AIMessage,HumanMessage
    from tests.test_technical_analysis_agent import fixture_fetcher
    from graph.primary_graphs.technical_analysis_agent.workflow import build_technical_analysis_agent
    from graph.primary_graphs.technical_analysis_canvas_agent.workflow import build_technical_analysis_canvas_agent

    class ToolModel(FakeMessagesListChatModel):
        def bind_tools(self,*args,**kwargs):
            return self

    responses=([AIMessage(content='ANALYSIS')] if canvas else [])+[
        AIMessage(content='',tool_calls=[{'name':'get_price_ohlcv','args':{'ticker':'TEST','count':60},'id':'prices'}]),
        AIMessage(content='',tool_calls=[{'name':'analyze_ohlcv_with_talib','args':{'all_indicators':True},'id':'all20'}]),
        AIMessage(content='전체20개 계산 완료'),
    ]
    async def validator(program):
        assert ('CanvasItem(' in program) if canvas else ('IndicatorControls(' in program)
        assert 'schema_version' in program
        return []
    model=ToolModel(responses=responses)
    builder=build_technical_analysis_canvas_agent if canvas else build_technical_analysis_agent
    graph=builder(model=model,fetcher=fixture_fetcher,validator=validator)
    result=await graph.ainvoke({'messages':[HumanMessage(content='TEST 전체 20개 지표로 분석해줘')]})
    assert len(result['analysis_result']['indicators'])==20
    assert {i['name'] for i in result['analysis_result']['indicators']}==set(NAMES)
    if canvas:
        saved = next(iter(result['canvas_reports'].values()))
        assert saved['status']=='ready'
        assert result['presentation']['id'] == saved['reportId']
        assert len(saved['elements']) == 21
        assert '전체20개 계산 완료' in str(result['messages'][-1].content)
    else:
        assert result['presentation']['program']
