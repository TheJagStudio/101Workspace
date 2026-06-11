from django.core.management.base import BaseCommand

from supplychain.dusty_cache import refresh_dusty_inventory_cache


class Command(BaseCommand):
    help = "Pre-build dusty inventory cache (run weekly, e.g. Saturday night cron)."

    def add_arguments(self, parser):
        parser.add_argument("--store-ids", default="1,2", help="Comma-separated store IDs")
        parser.add_argument(
            "--days",
            default="60,90,120,180",
            help="Comma-separated day thresholds to warm",
        )

    def handle(self, *args, **options):
        store_ids = options["store_ids"]
        thresholds = [int(d.strip()) for d in options["days"].split(",") if d.strip()]
        results = refresh_dusty_inventory_cache(store_ids, thresholds)
        for row in results:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Cached {row['itemCount']} SKUs for storeIds={row['storeIds']} "
                    f"daysThreshold={row['daysThreshold']} at {row['cachedAt']}"
                )
            )
