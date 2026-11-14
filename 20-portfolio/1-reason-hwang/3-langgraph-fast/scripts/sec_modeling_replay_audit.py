"""Read-only filing-scoped replay audit; input equality is not a provider call counter."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from domains.sec_modeling.chunking import chunk_html
from domains.sec_modeling.store import GraphStore

FILINGS = {
    '0000320193': 'filing:0000320193:0000320193-26-000026',
    '0001834584': 'filing:0001834584:0001834584-26-000024',
    '0001045810': 'filing:0001045810:0001045810-26-000021',
}


def text_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()


def snapshot(graph, filing):
    active = graph.active(filing, 2)
    assert active, 'A published model-2 generation is required before replay'
    keys = graph.query(
        "MATCH (v:SecVector) WHERE v.embeddingModel='text-embedding-3-small' "
        'AND size(v.embedding)=1536 AND v.embeddingCacheKey IS NOT NULL '
        'RETURN DISTINCT v.filingId AS filing,v.embeddingCacheKey AS key'
    )
    grouped = {}
    for row in keys:
        grouped.setdefault(row['filing'], []).append(row['key'])
    return {'embeddingKeys': grouped, 'priorModel2': {filing: {
        'generationId': active['id'],
        'chunkHashes': dict(Counter(text_hash(r['value']) for r in graph.records(active['id'], 'Chunk'))),
    }}}


def verify(graph, filing, before):
    active = graph.active(filing, 2)
    first = graph.active(filing, 1)
    assert active and first and active['inputGenerationId'] == first['id']
    previous = before['priorModel2'][filing]
    assert active['id'] != previous['generationId'], 'Replay must publish a new generation'
    old = Counter(previous['chunkHashes'])
    current = Counter(text_hash(r['value']) for r in graph.records(active['id'], 'Chunk'))
    expected = Counter(text_hash(text) for item in graph.records(first['id'], 'Item') for text in chunk_html(item['displayHtml']))
    assert current == expected, 'Published chunks must exactly match the current structural chunker'
    vectors = graph.query(
        'MATCH (v:SecVector {generationId:$generation}) RETURN count(v) AS total,'
        'collect(DISTINCT v.embeddingCacheKey) AS keys,'
        'sum(CASE WHEN size(v.embedding)=1536 THEN 0 ELSE 1 END) AS invalid',
        generation=active['id'],
    )[0]
    assert vectors['total'] and vectors['invalid'] == 0
    available = {key for values in before['embeddingKeys'].values() for key in values}
    used = set(vectors['keys'])
    return {
        'filingId': filing, 'generationId': active['id'], 'previousGenerationId': previous['generationId'],
        'chunks': sum(current.values()), 'unchangedChunkInputs': sum((old & current).values()),
        'changedChunkInputs': sum((current - old).values()), 'vectors': vectors['total'],
        'uniqueEmbeddingInputs': len(used), 'embeddingInputsAvailableBeforeReplay': len(used & available),
        'embeddingInputsNewSinceSnapshot': len(used - available), 'providerCallsMeasured': False,
        'note': 'Scoped input/key comparison; concurrent shared LLM cache growth is not attributed to this run.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['snapshot', 'verify'])
    parser.add_argument('--cik', choices=FILINGS, required=True)
    parser.add_argument('--before', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    graph = GraphStore()
    try:
        if args.mode == 'snapshot':
            result = snapshot(graph, FILINGS[args.cik])
        else:
            if not args.before:
                parser.error('--before is required for verify')
            result = verify(graph, FILINGS[args.cik], json.loads(args.before.read_text()))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, sort_keys=True, indent=2))
        print(json.dumps({'snapshot': str(args.output)} if args.mode == 'snapshot' else result))
    finally:
        graph.close()


if __name__ == '__main__':
    main()
