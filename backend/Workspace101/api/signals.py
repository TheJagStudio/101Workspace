from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Abs
from decimal import Decimal

from .models import Product, ProductHistory

# The helper function to calculate and update both metrics
def _calculate_and_update_product_metrics(product_instance):
    """
    Helper function to calculate and update a product's cached revenue and gross margin.
    """
    if product_instance:
        aggregated_data = ProductHistory.objects.filter(
            productId_id=product_instance.productId # Filter by the product's actual ID
        ).aggregate(
            calculated_revenue=Sum(F("quantity") * F("retailPrice"), output_field=DecimalField()),
            calculated_gross_margin=Sum(
                Abs(F("quantity") * (F("retailPrice") - F("costPrice"))),
                output_field=DecimalField()
            )
        )
        
        product_instance.TotalRevenue = aggregated_data.get('calculated_revenue') or Decimal('0.00')
        product_instance.TotalGrossMargin = aggregated_data.get('calculated_gross_margin') or Decimal('0.00')
        
        # Save only the updated fields to prevent re-triggering unnecessary signals
        product_instance.save(update_fields=['TotalGrossMargin', 'TotalRevenue'])

