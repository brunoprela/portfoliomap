// portfolio tickerplant
// ---------------------------------------------------------------

\l scripts/config.q
\l scripts/schema.q

logRoot:logDir
system"mkdir -p ",logRoot

\d .u

/ Available tables
t:`trades`quotes`orders`positions

/ Subscriber tracking: dict of handle -> (tables;symbols)
w:t!count[t]#()

/ Remove handle from subscribers
del:{w[x]_:w[x;;0]?y};

/ Client disconnect handler
.z.pc:{del[;x]each t}

/ Filter data by symbol list
sel:{$[`~y;x;`sym in cols x;select from x where sym in y;x]}

/ Publish to subscribers
pub:{[t;x]{[t;x;w]if[count x:sel[x]w 1;(neg first w)(`upd;t;x)]}[t;x]each w t}

/ Add subscriber
add:{$[(count w x)>i:w[x;;0]?.z.w;.[`.u.w;(x;i;1);union;y];w[x],:enlist(.z.w;y)];(x;$[99=type v:value x;sel[v]y;0#v])}

/ Subscribe to table(s) and symbol(s)
sub:{if[x~`;:sub[;y]each t];if[not x in t;'x];del[x].z.w;add[x;y]}

/ Publish update and log
upd:{[tbl;x]
  if[not tbl in t;'`unknownTable];
  tbl insert x;
  pub[tbl;x];
  }

\d .
