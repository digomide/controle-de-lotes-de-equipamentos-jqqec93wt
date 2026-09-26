# BACKUP / SNAPSHOT DE REFERÊNCIA — PRÉ-RECUO MULTI-TENANT (v0.0.260)

Data: 2026-09-26
Versão de Referência: v0.0.260
Projeto: AmbicorpFlow (Controle de Lotes de Equipamentos)

## Objetivo deste Snapshot

Este documento e o estado do repositório neste ponto registram o estado completo da aplicação antes do recuo da arquitetura multi-tenant (Filial) de volta para a operação de conta única (Ambicorp Mestre / INFOPRECOBAIXO).

Caso seja necessário restaurar a operação multi-tenant com filiais no futuro ou auditar o comportamento anterior:

1. Os dados no banco de dados (PocketBase) NÃO foram e NÃO serão excluídos. Os registros vinculados à filial (`tenant_id = '3jcqzgllyswysil'`) permanecem intactos nas tabelas:
   - `tenants` (id: ambicorpmestre1 [Ambicorp Mestre] e 3jcqzgllyswysil [Filial])
   - `products`, `batches`, `sales`, `sale_items`, `purchase_batches`
   - `equipment_parts`, `equipment_deliverables`, `general_inventory_items`
   - `ml_settings`, `ml_catalog_search_jobs`, `ml_catalog_publish_jobs`, etc.
2. A migração 0503_create_multi_tenant_architecture.js documenta a estrutura original com isolamento por tenant.
3. As coleções mantêm a coluna `tenant_id` intacta no banco de dados para retrocompatibilidade futura.

## Diagnóstico Realizado nesta Versão

- Erro no hook de status do Mercado Livre: a coleção `tenants` foi criada na migração 0503 sem campos autodate `created` e `updated`. Quando o hook `ml_status.js` consultava `tenants` ordenando por `-created`, o PocketBase Goja lançava a exceção: `GoError: invalid sort field "created"`, quebrando o retorno de status da conexão e fazendo a interface pensar que a conta estava desconectada.
- Edição de preços do Mercado Livre: anúncios com catálogo do ML bloqueiam via API (403 PolicyAgent) com a mensagem `"At least one policy returned UNAUTHORIZED"`. O recuo garante que mesmo registros antigos marcados com tenant de filial usem as credenciais ativas do tenant principal (INFOPRECOBAIXO).
