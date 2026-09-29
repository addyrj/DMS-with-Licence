// loading.js — skeleton shown while page data loads
export default function Loading() {
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><div className="skeleton" style={{width:200,height:28,marginBottom:8}} /><div className="skeleton" style={{width:140,height:16}} /></div>
        <div className="skeleton" style={{width:120,height:40}} />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}}>
        {[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{height:100,borderRadius:20}} />)}
      </div>
      <div className="skeleton" style={{height:300,borderRadius:20}} />
    </div>
  );
}
