import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOPIFY_STORE_QUERY,SHOPIFY_ORDERS_QUERY,SHOPIFY_VARIANTS_QUERY,aggregateShopifyOrders,aggregateShopifyInventory,collectShopifyOperatingSnapshot} from '../lib/shopify-sync.js';

const money=amount=>({shopMoney:{amount:String(amount),currencyCode:'USD'}});

const orders=[
  {
    id:'o1',createdAt:'2026-09-01T23:30:00Z',cancelledAt:null,test:false,currencyCode:'USD',
    currentShippingPriceSet:money(5),currentTotalTaxSet:money(6),currentTotalDiscountsSet:money(10),currentTotalPriceSet:money(89),totalRefundedSet:money(0),
    lineItems:{pageInfo:{hasNextPage:false},nodes:[
      {sku:'HD-M',currentQuantity:1,originalUnitPriceSet:money(78),variant:{id:'v1'}},
      {sku:'SOCK',currentQuantity:2,originalUnitPriceSet:money(10),variant:{id:'v2'}}
    ]}
  },
  {
    id:'o2',createdAt:'2026-09-02T01:00:00Z',cancelledAt:null,test:false,currencyCode:'USD',
    currentShippingPriceSet:money(0),currentTotalTaxSet:money(2),currentTotalDiscountsSet:money(0),currentTotalPriceSet:money(36),totalRefundedSet:money(5),
    lineItems:{pageInfo:{hasNextPage:false},nodes:[{sku:'TEE-L',currentQuantity:1,originalUnitPriceSet:money(34),variant:{id:'v3'}}]}
  },
  {id:'test',createdAt:'2026-09-02T12:00:00Z',test:true,cancelledAt:null,currencyCode:'USD',lineItems:{pageInfo:{hasNextPage:false},nodes:[]}},
  {id:'cancel',createdAt:'2026-09-02T12:00:00Z',test:false,cancelledAt:'2026-09-02T13:00:00Z',currencyCode:'USD',lineItems:{pageInfo:{hasNextPage:false},nodes:[]}}
];

test('Shopify aggregation is PII-free and groups by merchant local date',()=>{
  const result=aggregateShopifyOrders(orders,{timeZone:'America/New_York'});
  assert.equal(result.dailySnapshots.length,1,'both real orders are Sep 1 in New York');
  const day=result.dailySnapshots[0];
  assert.equal(day.snapshot_date,'2026-09-01');
  assert.equal(day.order_count,2);
  assert.equal(day.units_sold,4);
  assert.equal(day.gross_sales,132);
  assert.equal(day.discounts,10);
  assert.equal(day.net_sales,122);
  assert.equal(day.refunds,5);
  assert.equal(day.shipping_collected,5);
  assert.equal(day.taxes_collected,8);
  assert.equal(result.stats.testOrders,1);
  assert.equal(result.stats.cancelledOrders,1);
  assert.equal(result.velocityByVariant.get('v1'),1);
  assert.equal(result.velocityBySku.get('SOCK'),2);
  assert.doesNotMatch(JSON.stringify(result.dailySnapshots),/email|address|customer/i);
  assert.match(day.source_payload.net_sales_definition,/not Shopify Analytics official net sales/i);
});

test('Shopify inventory sums current quantity states across locations and derives velocity',()=>{
  const variants=[{
    id:'v1',title:'M',sku:'HD-M',product:{title:'Heavy Hoodie'},inventoryItem:{id:'i1',sku:'HD-M',tracked:true,inventoryLevels:{pageInfo:{hasNextPage:false},nodes:[
      {quantities:[{name:'on_hand',quantity:20},{name:'available',quantity:15},{name:'committed',quantity:5},{name:'incoming',quantity:10}]},
      {quantities:[{name:'on_hand',quantity:15},{name:'available',quantity:12},{name:'committed',quantity:3},{name:'incoming',quantity:0}]}
    ]}}
  }];
  const velocityByVariant=new Map([['v1',14]]);
  const result=aggregateShopifyInventory(variants,{velocityByVariant,velocityWindowWeeks:2});
  const row=result.inventorySnapshots[0];
  assert.equal(row.on_hand,35);
  assert.equal(row.available,27);
  assert.equal(row.committed,8);
  assert.equal(row.incoming,10);
  assert.equal(row.weekly_velocity,7);
  assert.equal(row.source,'shopify');
  assert.equal(row.sku_code,'HD-M');
  assert.equal(row.source_payload.locations_read,2);
});

test('initial Shopify sync paginates within caps and marks truncation instead of pretending completeness',async()=>{
  const calls=[];
  const graphql=async(query,variables)=>{
    calls.push({query,variables});
    if(query===SHOPIFY_STORE_QUERY)return {shop:{id:'s1',name:'Foundry Eight',currencyCode:'USD',ianaTimezone:'America/New_York'}};
    if(query===SHOPIFY_ORDERS_QUERY)return {orders:{nodes:orders.slice(0,1),pageInfo:{hasNextPage:true,endCursor:'orders-next'}}};
    if(query===SHOPIFY_VARIANTS_QUERY)return {productVariants:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}};
    throw new Error('unexpected query');
  };
  const result=await collectShopifyOperatingSnapshot({graphql,now:Date.parse('2026-09-15T00:00:00Z'),lookbackDays:60,maxOrderPages:1,maxVariantPages:1,pageSize:100});
  assert.equal(result.partial,true);
  assert.equal(result.cursors.orders,'orders-next');
  assert.equal(result.shop.ianaTimezone,'America/New_York');
  assert.match(result.orderQuery,/created_at:>=2026-07-17/);
  assert.equal(calls[1].variables.first,100);
});
