"""Read-only verification of published SEC model-3 facts, schema, and identities."""
import json

from domains.sec_modeling.model3 import digest
from domains.sec_modeling.store import GraphStore

FILINGS = [
    ('AAPL', 'filing:0000320193:0000320193-26-000026'),
    ('CPNG', 'filing:0001834584:0001834584-26-000024'),
    ('NVDA', 'filing:0001045810:0001045810-26-000021'),
]
LABELS = ['XbrlFact', 'Concept', 'Context', 'Dimension', 'Member', 'DimensionValue', 'Unit']

def verify():
    store = GraphStore()
    try:
        for ticker, filing in FILINGS:
            active = store.active(filing, 3)
            assert active, f'{ticker}: missing published model 3'
            generation = active['id']
            facts = store.records(generation, 'XbrlFact')
            assert facts
            groups = {}
            expected_contexts = {}
            for fact in facts:
                key = digest([
                    fact['conceptQName'],
                    {k: v for k, v in fact['context'].items() if k != 'sourceContextIds'},
                    fact['dimensions'], fact['unit'],
                ])
                assert key == fact['duplicateGroup']
                groups.setdefault(key, set()).add(fact['normalizedValue'])
                context_key = generation + ':context:' + digest([
                    {k: v for k, v in fact['context'].items() if k != 'sourceContextIds'},
                    fact['dimensions'],
                ])
                expected_contexts.setdefault(context_key, set()).update(fact['context']['sourceContextIds'])
            assert all(f['conflict'] == (len(groups[f['duplicateGroup']]) > 1) for f in facts)
            contexts = store.query(
                'MATCH (c:Context) WHERE c.id STARTS WITH $prefix RETURN c.id AS id,c.sourceContextIds AS sourceIds',
                prefix=generation + ':',
            )
            assert len(contexts) == len(expected_contexts)
            assert all(set(c['sourceIds']) == expected_contexts[c['id']] and len(c['sourceIds']) == len(set(c['sourceIds'])) for c in contexts)
            missing_properties = store.query(
                'MATCH (n) WHERE n.id STARTS WITH $prefix AND '
                '((n:Dimension OR n:Member) AND (n.namespaceUri IS NULL OR n.localName IS NULL OR n.label IS NULL OR n.label="")) '
                'RETURN count(n) AS count', prefix=generation + ':',
            )[0]['count']
            assert missing_properties == 0, f'{ticker}: missing Dimension/Member descriptive properties'
            missing_taxonomy = store.query(
                'MATCH (n:Concept) WHERE n.id STARTS WITH $prefix AND (n.taxonomyHash IS NULL OR size(n.taxonomyHash)<>64) RETURN count(n) AS count',
                prefix=generation + ':',
            )[0]['count']
            assert missing_taxonomy == 0, f'{ticker}: missing Concept taxonomy hash'
            mismatched_taxonomy = store.query(
                'MATCH (x:XbrlFact)-[:OF_CONCEPT]->(c:Concept) WHERE x.id STARTS WITH $prefix AND x.taxonomyHash<>c.taxonomyHash RETURN count(x) AS count',
                prefix=generation + ':',
            )[0]['count']
            assert mismatched_taxonomy == 0
            counts = store.query(
                'MATCH (n) WHERE n.id STARTS WITH $prefix UNWIND labels(n) AS label '
                'WITH label,n WHERE label IN $labels RETURN label,count(n) AS count ORDER BY label',
                prefix=generation + ':', labels=LABELS,
            )
            assert {row['label'] for row in counts} == set(LABELS)
            relations = store.query(
                'MATCH (n)-[r]->() WHERE n.id STARTS WITH $prefix '
                'RETURN type(r) AS type,count(r) AS count ORDER BY type',
                prefix=generation + ':',
            )
            filing_edges = store.query(
                'MATCH (:Filing {id:$filing})-[:HAS_XBRL_FACT]->(x:XbrlFact) '
                'WHERE x.id STARTS WITH $prefix RETURN count(x) AS count',
                filing=filing, prefix=generation + ':',
            )[0]['count']
            assert filing_edges == len(facts)
            relations.append({'type': 'HAS_XBRL_FACT', 'count': filing_edges})
            kinds = {row['type'] for row in relations}
            assert {'FOR_ENTITY', 'OF_CONCEPT', 'IN_CONTEXT', 'IN_UNIT',
                    'HAS_DIMENSION_VALUE', 'OF_DIMENSION', 'HAS_MEMBER'} <= kinds
            if ticker == 'CPNG':
                fact = next(f for f in facts if f['sourceFactId'] == 'f-57')
                assert fact['rawValue'] == '26,312'
                assert fact['normalizedValue'] == '26312000000'
                assert fact['context']['startDate'] == '2025-01-01'
                assert fact['context']['endDate'] == '2025-12-31'
                assert fact['context']['sourceContextIds'] == ['c-7']
                assert fact['unit']['numerator'] == ['{http://www.xbrl.org/2003/iso4217}USD']
                assert any(d['dimension'].endswith('ProductOrServiceAxis') and d['member'].endswith('ProductMember') for d in fact['dimensions'])
                assert fact['taxonomyHash']
            print(json.dumps({'ticker': ticker, 'generation': generation, 'facts': len(facts),
                              'conflicts': sum(f['conflict'] for f in facts), 'nodes': counts,
                              'relationships': relations, 'descriptivePropertiesValid': True,
                              'contextSourceIdsUnionValid': True, 'taxonomyHashesValid': True}))
    finally:
        store.close()

if __name__ == '__main__':
    verify()
