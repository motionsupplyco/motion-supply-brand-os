const finiteOrNull=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
const finite=value=>Number.isFinite(Number(value))?Number(value):0;

export const SHOPIFY_STORE_QUERY=`#graphql
query BrandOSShop {
  shop { id name currencyCode ianaTimezone }
}`;

export const SHOPIFY_ORDERS_QUERY=`#graphql
query BrandOSOrders($first:Int!,$after:String,$query:String!) {
  orders(first:$first,after:$after,sortKey:CREATED_AT,query:$query) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id createdAt cancelledAt test currencyCode
      currentShippingPriceSet { shopMoney { amount currencyCode } }
      currentTotalTaxSet { shopMoney { amount currencyCode } }
      currentTotalDiscountsSet { shopMoney { amount currencyCode } }
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount currencyCode } }
      lineItems(first:100) {
        pageInfo { hasNextPage }
        nodes {
          sku currentQuantity
          originalUnitPriceSet { shopMoney { amount currencyCode } }
          variant { id }
        }
      }
    }
  }
}`;

export const SHOPIFY_VARIANTS_QUERY=`#graphql
query BrandOSVariants($first:Int!,$after:String) {
  productVariants(first:$first,after:$after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title sku
      product { title }
      inventoryItem {
        id sku tracked
        inventoryLevels(first:50) {
          pageInfo { hasNextPage }
          nodes {
            quantities(names:["on_hand","available","incoming","committed"]) { name quantity }
          }
        }
      }
    }
  }
}`;

const shopMoney=set=>finiteOrNull(set?.shopMoney?.amount);
const dateParts=(date,timeZone)=>{
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone:timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=Object.fromEntries(formatter.formatToParts(new Date(date)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const addNullable=(current,value)=>value===null?current:(current===null?value:current+value);

export function aggregateShopifyOrders(orders=[],{timeZone='UTC'}={}){
  const byDate=new Map();
  const velocityByVariant=new Map();
  const velocityBySku=new Map();
  let testOrders=0,cancelledOrders=0,lineItemPaginationWarnings=0;
  for(const order of Array.isArray(orders)?orders:[]){
    if(order?.test){testOrders++;continue}
    if(order?.cancelledAt){cancelledOrders++;continue}
    if(!order?.createdAt)continue;
    const date=dateParts(order.createdAt,timeZone);
    if(!byDate.has(date))byDate.set(date,{
      snapshot_date:date,currency:String(order.currencyCode||'USD'),gross_sales:null,net_sales:null,refunds:null,discounts:null,
      shipping_collected:null,taxes_collected:null,order_count:0,units_sold:0,
      source_payload:{definition_version:'shopify_graphql_v1',net_sales_definition:'Current non-refunded merchandise units at original unit price minus current order discounts. Excludes shipping and tax. This is an operational Brand OS measure, not Shopify Analytics official net sales.',incomplete_line_items:false}
    });
    const row=byDate.get(date);
    const lines=order?.lineItems?.nodes||[];
    if(order?.lineItems?.pageInfo?.hasNextPage){row.source_payload.incomplete_line_items=true;lineItemPaginationWarnings++}
    let gross=0,units=0;
    for(const line of lines){
      const quantity=Math.max(0,Math.trunc(finite(line?.currentQuantity)));
      const unitPrice=shopMoney(line?.originalUnitPriceSet);
      units+=quantity;
      if(unitPrice!==null)gross+=unitPrice*quantity;
      if(quantity>0&&line?.variant?.id)velocityByVariant.set(String(line.variant.id),(velocityByVariant.get(String(line.variant.id))||0)+quantity);
      if(quantity>0&&line?.sku)velocityBySku.set(String(line.sku),(velocityBySku.get(String(line.sku))||0)+quantity);
    }
    const discounts=shopMoney(order.currentTotalDiscountsSet);
    const net=discounts===null?gross:Math.max(0,gross-discounts);
    row.gross_sales=addNullable(row.gross_sales,gross);
    row.net_sales=addNullable(row.net_sales,net);
    row.refunds=addNullable(row.refunds,shopMoney(order.totalRefundedSet));
    row.discounts=addNullable(row.discounts,discounts);
    row.shipping_collected=addNullable(row.shipping_collected,shopMoney(order.currentShippingPriceSet));
    row.taxes_collected=addNullable(row.taxes_collected,shopMoney(order.currentTotalTaxSet));
    row.order_count++;
    row.units_sold+=units;
  }
  return {
    dailySnapshots:[...byDate.values()].sort((a,b)=>a.snapshot_date.localeCompare(b.snapshot_date)),
    velocityByVariant,velocityBySku,
    stats:{ordersIncluded:[...byDate.values()].reduce((sum,row)=>sum+row.order_count,0),testOrders,cancelledOrders,lineItemPaginationWarnings}
  };
}

export function aggregateShopifyInventory(variants=[],{velocityByVariant=new Map(),velocityBySku=new Map(),velocityWindowWeeks=4}={}){
  let inventoryLevelPaginationWarnings=0;
  const snapshots=[];
  for(const variant of Array.isArray(variants)?variants:[]){
    const totals={on_hand:0,available:0,incoming:0,committed:0};
    const levels=variant?.inventoryItem?.inventoryLevels?.nodes||[];
    if(variant?.inventoryItem?.inventoryLevels?.pageInfo?.hasNextPage)inventoryLevelPaginationWarnings++;
    for(const level of levels){
      for(const quantity of level?.quantities||[]){
        if(Object.prototype.hasOwnProperty.call(totals,quantity?.name))totals[quantity.name]+=Math.trunc(finite(quantity?.quantity));
      }
    }
    const sku=String(variant?.sku||variant?.inventoryItem?.sku||'').trim()||null;
    const sold=velocityByVariant.get(String(variant?.id))??(sku?velocityBySku.get(sku):0)??0;
    snapshots.push({
      source:'shopify',external_variant_id:String(variant?.id||'')||null,sku_code:sku,
      product_name:[variant?.product?.title,variant?.title].filter(Boolean).join(' · ')||sku||'Shopify variant',
      on_hand:totals.on_hand,available:totals.available,incoming:totals.incoming,committed:totals.committed,
      weekly_velocity:velocityWindowWeeks>0?sold/velocityWindowWeeks:null,
      source_payload:{inventory_item_id:variant?.inventoryItem?.id||null,tracked:Boolean(variant?.inventoryItem?.tracked),locations_read:levels.length,incomplete_locations:Boolean(variant?.inventoryItem?.inventoryLevels?.pageInfo?.hasNextPage)}
    });
  }
  return {inventorySnapshots:snapshots,stats:{variants:snapshots.length,inventoryLevelPaginationWarnings}};
}

function isoDateDaysAgo(now,days){
  const date=new Date(now-Math.max(0,days)*86400_000);
  return date.toISOString().slice(0,10);
}

export async function collectShopifyOperatingSnapshot({graphql,now=Date.now(),lookbackDays=60,maxOrderPages=5,maxVariantPages=5,pageSize=100}={}){
  if(typeof graphql!=='function')throw new Error('Shopify GraphQL client is required.');
  const shopData=await graphql(SHOPIFY_STORE_QUERY,{});
  const shop=shopData?.shop;
  if(!shop?.ianaTimezone||!shop?.currencyCode)throw new Error('Shopify shop metadata is incomplete.');
  const orderNodes=[];
  let orderAfter=null,ordersPartial=false,ordersEndCursor=null;
  const orderQuery=`created_at:>=${isoDateDaysAgo(now,lookbackDays)}`;
  for(let page=0;page<maxOrderPages;page++){
    const data=await graphql(SHOPIFY_ORDERS_QUERY,{first:pageSize,after:orderAfter,query:orderQuery});
    const connection=data?.orders;if(!connection)throw new Error('Shopify orders response is incomplete.');
    orderNodes.push(...(connection.nodes||[]));
    ordersEndCursor=connection.pageInfo?.endCursor||null;
    if(!connection.pageInfo?.hasNextPage){orderAfter=null;break}
    orderAfter=ordersEndCursor;
    if(page===maxOrderPages-1)ordersPartial=true;
  }
  const aggregatedOrders=aggregateShopifyOrders(orderNodes,{timeZone:shop.ianaTimezone});

  const variantNodes=[];
  let variantAfter=null,variantsPartial=false,variantsEndCursor=null;
  for(let page=0;page<maxVariantPages;page++){
    const data=await graphql(SHOPIFY_VARIANTS_QUERY,{first:pageSize,after:variantAfter});
    const connection=data?.productVariants;if(!connection)throw new Error('Shopify variants response is incomplete.');
    variantNodes.push(...(connection.nodes||[]));
    variantsEndCursor=connection.pageInfo?.endCursor||null;
    if(!connection.pageInfo?.hasNextPage){variantAfter=null;break}
    variantAfter=variantsEndCursor;
    if(page===maxVariantPages-1)variantsPartial=true;
  }
  const aggregatedInventory=aggregateShopifyInventory(variantNodes,{velocityByVariant:aggregatedOrders.velocityByVariant,velocityBySku:aggregatedOrders.velocityBySku,velocityWindowWeeks:Math.max(1,lookbackDays/7)});
  const partial=ordersPartial||variantsPartial||aggregatedOrders.stats.lineItemPaginationWarnings>0||aggregatedInventory.stats.inventoryLevelPaginationWarnings>0;
  return {
    shop:{id:shop.id,name:shop.name,currencyCode:shop.currencyCode,ianaTimezone:shop.ianaTimezone},
    lookbackDays,orderQuery,
    dailySnapshots:aggregatedOrders.dailySnapshots.map(row=>({...row,currency:shop.currencyCode})),
    inventorySnapshots:aggregatedInventory.inventorySnapshots,
    partial,
    cursors:{orders:ordersPartial?ordersEndCursor:null,variants:variantsPartial?variantsEndCursor:null},
    stats:{...aggregatedOrders.stats,...aggregatedInventory.stats,orderNodesRead:orderNodes.length,variantNodesRead:variantNodes.length}
  };
}
