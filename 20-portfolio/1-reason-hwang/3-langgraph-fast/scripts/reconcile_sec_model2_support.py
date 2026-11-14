"""Narrow existing-node-only maintenance for validated model-2 support occurrences."""

import argparse
import json

from domains.sec_modeling.model2_support import reconcile_statement_support
from domains.sec_modeling.store import GraphStore


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("generations", nargs="+")
    args = parser.parse_args()
    store = GraphStore()
    try:
        for generation in args.generations:
            rows = store.query(
                "MATCH (g:SecGeneration {id:$generation,stage:2}) RETURN g.id AS id",
                generation=generation,
            )
            if len(rows) != 1:
                raise ValueError(
                    "Maintenance only accepts an existing model-2 generation"
                )
            print(
                json.dumps(
                    {
                        "generation": generation,
                        **reconcile_statement_support(store, generation),
                    }
                )
            )
    finally:
        store.close()


if __name__ == "__main__":
    main()
