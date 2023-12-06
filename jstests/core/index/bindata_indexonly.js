/**
 * This test ensures that range predicates with a BinData value:
 * 1) Return the correct documents.
 * 2) Can perform index-only data access.
 * @tags: [
 *   assumes_read_concern_local,
 * ]
 */
import {getOptimizer, isIndexOnly} from "jstests/libs/analyze_plan.js";

var coll = db.jstests_bindata_indexonly;

coll.drop();
assert.commandWorked(coll.insert({_id: BinData(0, "AAAAAAAAAAAAAAAAAAAAAAAAAAAA"), a: 1}));
assert.commandWorked(coll.insert({_id: BinData(0, "AQAAAAEBAAVlbl9VSwAAAAAAAAhv"), a: 2}));
assert.commandWorked(coll.insert({_id: BinData(0, "AQAAAAEBAAVlbl9VSwAAAAAAAAhz"), a: 3}));
assert.commandWorked(coll.insert({_id: BinData(0, "////////////////////////////"), a: 4}));
assert.commandWorked(coll.createIndex({_id: 1, a: 1}));

assert.throws(function() {
    db.mycoll.insert({_id: 0, a: BinData.prototype});
}, [], "bindata getter did not fail");

function testIndexOnlyBinData(blob) {
    var explain =
        coll.find({$and: [{_id: {$lte: BinData(0, blob)}}, {_id: {$gte: BinData(0, blob)}}]},
                  {_id: 1, a: 1})
            .hint({_id: 1, a: 1})
            .explain("executionStats");

    switch (getOptimizer(explain)) {
        case "classic":
            assert(isIndexOnly(db, explain.queryPlanner.winningPlan),
                   "indexonly.BinData(0, " + blob + ") - must be index-only");
            break;
        case "CQF":
            // TODO SERVER-77719: Ensure that the decision for using the scan lines up with CQF
            // optimizer. M2: allow only collscans, M4: check bonsai behavior for index scan.
            break;
    }
    assert.eq(1,
              explain.executionStats.nReturned,
              "EXACTone.BinData(0, " + blob + ") - should only return one in unique set");
}

testIndexOnlyBinData("AAAAAAAAAAAAAAAAAAAAAAAAAAAA");
testIndexOnlyBinData("AQAAAAEBAAVlbl9VSwAAAAAAAAhv");
testIndexOnlyBinData("AQAAAAEBAAVlbl9VSwAAAAAAAAhz");
testIndexOnlyBinData("////////////////////////////");

var explain;

explain = coll.find({_id: {$lt: BinData(0, "AAAAAAAAAAAAAAAAAAAAAAAAAAAA")}}, {_id: 1, a: 1})
              .hint({_id: 1, a: 1})
              .explain("executionStats");
switch (getOptimizer(explain)) {
    case "classic":
        assert(isIndexOnly(db, explain), "indexonly.$lt.1 - must be index-only");
        break;
    case "CQF":
        // TODO SERVER-77719: Ensure that the decision for using the scan lines up with CQF
        // optimizer. M2: allow only collscans, M4: check bonsai behavior for index scan.
        break;
}
assert.eq(
    0, explain.executionStats.nReturned, "correctcount.$lt.1 - not returning correct documents");

explain = coll.find({_id: {$gt: BinData(0, "////////////////////////////")}}, {_id: 1, a: 1})
              .hint({_id: 1, a: 1})
              .explain("executionStats");
switch (getOptimizer(explain)) {
    case "classic":
        assert(isIndexOnly(db, explain), "indexonly.$gt.2 - must be index-only");
        break;
    case "CQF":
        // TODO SERVER-77719: Ensure that the decision for using the scan lines up with CQF
        // optimizer. M2: allow only collscans, M4: check bonsai behavior for index scan.
        break;
}
assert.eq(
    0, explain.executionStats.nReturned, "correctcount.$gt.2 - not returning correct documents");

explain = coll.find({_id: {$lte: BinData(0, "AQAAAAEBAAVlbl9VSwAAAAAAAAhv")}}, {_id: 1, a: 1})
              .hint({_id: 1, a: 1})
              .explain("executionStats");
switch (getOptimizer(explain)) {
    case "classic":
        assert(isIndexOnly(db, explain), "indexonly.$lte.3 - must be index-only");
        break;
    case "CQF":
        // TODO SERVER-77719: Ensure that the decision for using the scan lines up with CQF
        // optimizer. M2: allow only collscans, M4: check bonsai behavior for index scan.
        break;
}
assert.eq(
    2, explain.executionStats.nReturned, "correctcount.$lte.3 - not returning correct documents");

explain = coll.find({_id: {$gte: BinData(0, "AQAAAAEBAAVlbl9VSwAAAAAAAAhz")}}, {_id: 1, a: 1})
              .hint({_id: 1, a: 1})
              .explain("executionStats");
switch (getOptimizer(explain)) {
    case "classic":
        assert(isIndexOnly(db, explain), "indexonly.$gte.3 - must be index-only");
        break;
    case "CQF":
        // TODO SERVER-77719: Ensure that the decision for using the scan lines up with CQF
        // optimizer. M2: allow only collscans, M4: check bonsai behavior for index scan.
        break;
}
assert.eq(
    2, explain.executionStats.nReturned, "correctcount.$gte.3 - not returning correct documents");

coll.drop();
