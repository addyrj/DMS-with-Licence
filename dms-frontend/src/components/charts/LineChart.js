// src/components/charts/LineChart.js
'use client';
import { LineChart as RC, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function RevenueChart({ data = [] }) {
  const demo = data.length ? data : [
    {name:'Mon',sales:18000,views:30000},{name:'Tue',sales:22000,views:28000},
    {name:'Wed',sales:38050,views:42000},{name:'Thu',sales:29000,views:35000},
    {name:'Fri',sales:41000,views:48000},{name:'Sat',sales:35000,views:40000},
    {name:'Sun',sales:52000,views:55000},
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RC data={demo}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{fontSize:12,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} />
        <YAxis tick={{fontSize:12,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`} />
        <Tooltip contentStyle={{borderRadius:10,border:'1px solid var(--border)',boxShadow:'var(--shadow-md)'}} />
        <Legend iconType="circle" iconSize={8} />
        <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{r:5}} name="Sales" />
        <Line type="monotone" dataKey="views" stroke="var(--secondary)" strokeWidth={2.5} dot={false} activeDot={{r:5}} name="Views" strokeDasharray="5 5" />
      </RC>
    </ResponsiveContainer>
  );
}
