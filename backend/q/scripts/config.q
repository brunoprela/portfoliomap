// shared configuration for portfolio q processes
// ---------------------------------------------------------------

tpPort:5010
rdbPort:5011
hdbPort:5012

tpHost:`localhost

tpEndpoint:hsym `$":",string tpHost,":",string tpPort
rdbEndpoint:hsym `$":",string tpHost,":",string rdbPort
hdbEndpoint:hsym `$":",string tpHost,":",string hdbPort

rootDir:string system"pwd"
logDir:"./log"
hdbDir:"./hdb"

system"mkdir -p ",logDir
system"mkdir -p ",hdbDir
