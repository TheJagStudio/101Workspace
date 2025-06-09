# In your_app/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Abs
from decimal import Decimal

from .models import Product, InvoiceLineItem

# The helper function to calculate and update both metrics
def _calculate_and_update_product_metrics(product_instance):
    """
    Helper function to calculate and update a product's cached revenue and gross margin.
    """
    if product_instance:
        aggregated_data = InvoiceLineItem.objects.filter(
            productId=product_instance.productId # Filter by the product's actual ID
        ).aggregate(
            calculated_revenue=Sum(Abs('totalAmount'), output_field=DecimalField()),
            calculated_gross_margin=Sum(
                Abs(F("quantity") * (F("retailPrice") - F("costPrice"))),
                output_field=DecimalField()
            )
        )
		
        
        product_instance.TotalRevenue = aggregated_data.get('calculated_revenue') or Decimal('0.00')
        product_instance.TotalGrossMargin = aggregated_data.get('calculated_gross_margin') or Decimal('0.00')
        
        # Save only the updated fields to prevent re-triggering unnecessary signals
        product_instance.save(update_fields=['TotalGrossMargin', 'TotalRevenue'])


@receiver(post_save, sender=InvoiceLineItem)
def update_product_metrics_on_save(sender, instance, created, **kwargs):
    """
    Updates the associated Product's cached metrics when an InvoiceLineItem is saved.
    """
    if instance.productId: # Ensure the FK is not null
        _calculate_and_update_product_metrics(instance.productId)

@receiver(post_delete, sender=InvoiceLineItem)
def update_product_metrics_on_delete(sender, instance, **kwargs):
    """
    Updates the associated Product's cached metrics when an InvoiceLineItem is deleted.
    """
    if instance.productId: # Ensure the FK was not null before deletion
        _calculate_and_update_product_metrics(instance.productId)