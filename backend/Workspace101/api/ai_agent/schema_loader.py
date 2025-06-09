from django.apps import apps
from django.db import connection

def get_django_model_schema():
    """
    Introspects all Django models in the project and generates a dictionary
    containing schema information and descriptions.
    """
    schema_info = {}
    for app_config in apps.get_app_configs():
        for model in app_config.get_models():
            model_name = model.__name__
            table_name = model._meta.db_table or model._meta.model_name
            
            # Basic model description
            model_description = getattr(model._meta, 'verbose_name', model_name).replace('_', ' ').capitalize()
            if getattr(model._meta, 'help_text', None):
                model_description += f". {model._meta.help_text}"

            columns = []
            for field in model._meta.fields:
                column_name = field.column or field.name
                field_type = field.get_internal_type()
                verbose_name = getattr(field, 'verbose_name', field.name).replace('_', ' ').capitalize()
                help_text = getattr(field, 'help_text', '')
                
                description = f"'{column_name}' ({field_type})"
                if verbose_name and verbose_name != field.name.replace('_', ' ').capitalize():
                    description += f" - {verbose_name}"
                if help_text:
                    description += f": {help_text}"
                
                columns.append({
                    "name": column_name,
                    "type": field_type,
                    "description": description,
                    "is_primary_key": field.primary_key,
                    "is_foreign_key": field.many_to_one or field.one_to_one
                })
            
            # Add ManyToMany fields (Django's ORM often handles these implicitly for simple queries)
            for field in model._meta.many_to_many:
                m2m_name = field.name
                m2m_target_model = field.related_model.__name__
                columns.append({
                    "name": m2m_name,
                    "type": "ManyToManyField",
                    "description": f"Many-to-many relationship with {m2m_target_model} instances.",
                    "is_primary_key": False,
                    "is_foreign_key": False # Treated as separate joins for ORM/SQL
                })

            schema_info[model_name] = {
                "table_name": table_name,
                "model_description": model_description,
                "columns": columns,
            }
    return schema_info

def generate_schema_text_for_llm(schema_info):
    """
    Generates a human-readable text representation of the schema for the LLM.
    """
    schema_text = []
    for model_name, details in schema_info.items():
        schema_text.append(f"Table: {details['table_name']} (Django Model: {model_name})")
        schema_text.append(f"Description: {details['model_description']}")
        schema_text.append("Columns:")
        for col in details['columns']:
            pk_fk_info = []
            if col['is_primary_key']:
                pk_fk_info.append("PK")
            if col['is_foreign_key']:
                pk_fk_info.append("FK")
            pk_fk_str = f" ({', '.join(pk_fk_info)})" if pk_fk_info else ""
            
            schema_text.append(f"  - {col['name']}{pk_fk_str}: {col['description']}")
        schema_text.append("\n")
    return "\n".join(schema_text)

def get_table_sample_data(model, num_samples=3):
    """
    Retrieves sample data from a Django model.
    """
    try:
        sample_data = list(model.objects.all()[:num_samples].values())
        return sample_data
    except Exception as e:
        # Handle models with no objects or other database errors
        return []

def generate_full_context_for_llm():
    """
    Combines schema, descriptions, and sample data for the LLM.
    """
    schema_info = get_django_model_schema()
    full_context = []
    # Build a mapping from model name to (app_label, model_name)
    model_lookup = {}
    for app_config in apps.get_app_configs():
        for model in app_config.get_models():
            model_lookup[model.__name__] = (app_config.label, model.__name__)

    for model_name, details in schema_info.items():
        try:
            app_label, real_model_name = model_lookup.get(model_name, (None, None))
            if not app_label:
                raise LookupError(f"Could not find app label for model {model_name}")
            model_class = apps.get_model(app_label=app_label, model_name=real_model_name)

            full_context.append(f"--- Model: {model_name} (Table: {details['table_name']}) ---")
            full_context.append(f"Description: {details['model_description']}")

            full_context.append("\nColumns:")
            for col in details['columns']:
                pk_fk_info = []
                if col['is_primary_key']:
                    pk_fk_info.append("PK")
                if col['is_foreign_key']:
                    pk_fk_info.append("FK")
                pk_fk_str = f" ({', '.join(pk_fk_info)})" if pk_fk_info else ""
                full_context.append(f"  - {col['name']}{pk_fk_str}: {col['description']}")

            sample_data = get_table_sample_data(model_class)
            if sample_data:
                full_context.append("\nSample Data:")
                for row in sample_data:
                    # Limit the number of fields in sample data for brevity
                    display_row = {k: str(v)[:50] for k, v in row.items() if len(str(v)) < 50}
                    full_context.append(f"  {display_row}")
            full_context.append("\n")
        except Exception as e:
            print(f"Error processing model {model_name}: {e}")

    return "\n".join(full_context)

# Example usage for testing
# if __name__ == "__main__":
#     import os
#     import sys
#     import django
#     # Ensure the parent directory is in sys.path
#     sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
#     os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Workspace101.settings')
#     django.setup()
    
#     schema_info = get_django_model_schema()
#     # print(schema_info)
    
#     # Generate text for LLM
#     llm_context = generate_full_context_for_llm()
#     print(llm_context)