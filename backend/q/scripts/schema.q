// portfolio schema definitions for tickerplant, rdb, and hdb
// ------------------------------------------------------------------

trades:([]time:`timestamp$();sym:`symbol$();exchange:`symbol$();price:`float$();size:`long$();condition:`symbol$())
quotes:([]time:`timestamp$();sym:`symbol$();bid:`float$();bidSize:`long$();ask:`float$();askSize:`long$();source:`symbol$())
orders:([]time:`timestamp$();sym:`symbol$();id:`guid$();side:`symbol$();status:`symbol$();filledQty:`long$();remainingQty:`long$();limitPrice:`float$())
positions:([]date:`date$();sym:`symbol$();qty:`long$();avgPrice:`float$();marketValue:`float$();unrealizedPL:`float$())
