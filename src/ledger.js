export const totalCost = item => item.price + item.shipping + item.extra;
export const profit = item => item.sale ? item.sale.price - item.sale.shipping - item.sale.fee - totalCost(item) : null;
export function summarize(items) {
 return {cost: items.reduce((s,i)=>s+totalCost(i),0), revenue:items.reduce((s,i)=>s+(i.sale?.price||0),0), profit:items.reduce((s,i)=>s+(profit(i)??0),0), stock:items.filter(i=>!i.sale).length};
}
