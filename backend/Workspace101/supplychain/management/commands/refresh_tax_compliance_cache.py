from django.core.management.base import BaseCommand

from supplychain.tax_compliance_cache import DEFAULT_TAX_STATE_IDS, refresh_tax_compliance_cache


class Command(BaseCommand):
    help = "Pre-build tax compliance cache (run weekly, e.g. Saturday night cron)."

    def add_arguments(self, parser):
        parser.add_argument("--store-ids", default="1,2", help="Comma-separated store IDs")
        parser.add_argument("--tax-type-id", type=int, default=1, help="ERP tax type / class ID")
        parser.add_argument("--state-id", type=int, default=10, help="Primary state ID (Florida=10)")
        parser.add_argument(
            "--state-ids",
            default=",".join(str(s) for s in DEFAULT_TAX_STATE_IDS),
            help="Comma-separated state IDs for multi-state aggregation",
        )

    def handle(self, *args, **options):
        state_ids = [int(s.strip()) for s in options["state_ids"].split(",") if s.strip()]
        result = refresh_tax_compliance_cache(
            store_ids=options["store_ids"],
            tax_type_id=options["tax_type_id"],
            state_id=options["state_id"],
            state_ids=state_ids,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Cached tax compliance for storeIds={result['storeIds']}: "
                f"{result['stateCount']} states, "
                f"${result['totalTaxCollected']:,.2f} total tax at {result['cachedAt']}"
            )
        )
