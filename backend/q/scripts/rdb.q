// portfolio real-time database (RDB)
// ---------------------------------------------------------------

\l scripts/config.q
\l scripts/schema.q

currentDate:.z.D
symSet:`symbol$()

/ Connect to tickerplant
tpHandle:hopen `$":localhost:5010"

persistDay:{[date]
  dir:hdbDir , "/",string date;
  system"mkdir -p ",dir;
  {tableDir:dir , "/",string x , "/";
    system"mkdir -p ",tableDir;
    hsym `$":",tableDir set value x;
    } each `trades`quotes`orders`positions;
  if[count symSet;hsym `$":",dir,"/sym" set distinct symSet];
  }

rotateDay:{
  persistDay[currentDate];
  currentDate::.z.D;
  {value x set 0#value x} each `trades`quotes`orders`positions;
  symSet::`symbol$();
  }

checkDay:{
  if[currentDate<>.z.D;rotateDay[]];
  }

upd:{[tbl;data]
  if[not tbl in `trades`quotes`orders`positions;'`unknownTable];
  checkDay[];
  if[`sym in cols data;symSet::distinct symSet,data`sym];
  tbl insert data;
  }

.z.pc:{if[tpHandle<>0Nh;hclose tpHandle]}

/ Subscribe to all tables and symbols
tpHandle(`.u.sub;`;`)
