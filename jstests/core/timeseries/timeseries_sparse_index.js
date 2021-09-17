/**
 * Tests that sparse indexes are not allowed on a time-series measurement field.
 *
 * @tags: [
 *     assumes_no_implicit_collection_creation_after_drop,
 *     does_not_support_stepdowns,
 *     does_not_support_transactions,
 *     requires_fcv_51,
 *     requires_find_command,
 *     requires_getmore,
 * ]
 */
(function() {
"use strict";

load("jstests/core/timeseries/libs/timeseries.js");

if (!TimeseriesTest.timeseriesMetricIndexesEnabled(db.getMongo())) {
    jsTestLog(
        "Skipped test as the featureFlagTimeseriesMetricIndexes feature flag is not enabled.");
    return;
}

TimeseriesTest.run((insert) => {
    const collName = "timeseries_sparse_index";

    const timeFieldName = "tm";
    const metaFieldName = "mm";

    // Unique metadata values to create separate buckets.
    const docs = [
        {
            _id: 0,
            [timeFieldName]: ISODate(),
            [metaFieldName]: {tag: "a", loc: {type: "Point", coordinates: [3, 3]}},
            x: 1
        },
        {_id: 1, [timeFieldName]: ISODate(), [metaFieldName]: {tag: "b"}, y: 1},
        {_id: 2, [timeFieldName]: ISODate(), [metaFieldName]: {tag: "c"}, x: 1, y: 1}
    ];

    const setup = function(keyForCreate, shouldSucceed) {
        const coll = db.getCollection(collName);
        coll.drop();

        const options = {sparse: true};
        jsTestLog("Setting up collection: " + coll.getFullName() +
                  " with index: " + tojson(keyForCreate) + " and options: " + tojson(options));

        assert.commandWorked(db.createCollection(
            coll.getName(), {timeseries: {timeField: timeFieldName, metaField: metaFieldName}}));

        // Insert data on the time-series collection and index it.
        assert.commandWorked(insert(coll, docs), "failed to insert docs: " + tojson(docs));

        const res = coll.createIndex(keyForCreate, options);
        if (shouldSucceed) {
            assert.commandWorked(res,
                                 "failed to create index: " + tojson(keyForCreate) +
                                     " with options: " + tojson(options));
        } else {
            assert.commandFailedWithCode(res, ErrorCodes.InvalidOptions);
        }
    };

    const testHint = function(indexName, numDocsExpected) {
        const coll = db.getCollection(collName);
        const bucketsColl = db.getCollection("system.buckets." + collName);

        // Tests hint() using the index name.
        assert.eq(numDocsExpected, bucketsColl.find().hint(indexName).toArray().length);
        assert.eq(numDocsExpected, coll.find().hint(indexName).toArray().length);

        // Tests that hint() cannot be used when the index is hidden.
        assert.commandWorked(coll.hideIndex(indexName));
        assert.commandFailedWithCode(
            assert.throws(() => bucketsColl.find().hint(indexName).toArray()), ErrorCodes.BadValue);
        assert.commandFailedWithCode(assert.throws(() => coll.find().hint(indexName).toArray()),
                                                  ErrorCodes.BadValue);
        assert.commandWorked(coll.unhideIndex(indexName));
    };

    const testIndex = function(viewDefinition, bucketsDefinition, numDocsExpected) {
        const coll = db.getCollection(collName);
        const bucketsColl = db.getCollection("system.buckets." + collName);

        setup(viewDefinition, /*shouldSucceed=*/true);

        // Check definition on view
        let userIndexes = coll.getIndexes();
        assert.eq(1, userIndexes.length);
        assert.eq(viewDefinition, userIndexes[0].key);

        // Check definition on buckets collection
        let bucketIndexes = bucketsColl.getIndexes();
        assert.eq(1, bucketIndexes.length);
        assert.eq(bucketsDefinition, bucketIndexes[0].key);

        testHint(bucketIndexes[0].name, numDocsExpected);

        // Drop index by key pattern.
        assert.commandWorked(coll.dropIndex(viewDefinition));
        bucketIndexes = bucketsColl.getIndexes();
        assert.eq(0, bucketIndexes.length);
    };

    // Test metadata-only sparse indexes.
    testIndex({[`${metaFieldName}.tag`]: 1, [`${metaFieldName}.loc`]: "2dsphere"},
              {"meta.tag": 1, "meta.loc": "2dsphere"},
              1);
    testIndex({[`${metaFieldName}.tag`]: 1}, {"meta.tag": 1}, 3);
    testIndex({[`${metaFieldName}.abc`]: 1}, {"meta.abc": 1}, 0);

    // Cannot create sparse indexes on time-series measurements.
    setup({x: 1}, /*shouldSucceed=*/false);
    setup({y: -1}, /*shouldSucceed=*/false);
    setup({x: 1, y: 1}, /*shouldSucceed=*/false);
    setup({z: 1}, /*shouldSucceed=*/false);

    // Compound sparse indexes are not allowed if measurements are involved.
    setup({x: 1, [`${metaFieldName}.loc`]: "2dsphere"}, /*shouldSucceed=*/false);
    setup({[`${timeFieldName}`]: 1, x: 1}, /*shouldSucceed=*/false);

    // Test compound time and metadata sparse indexes.
    testIndex({[`${timeFieldName}`]: 1, [`${metaFieldName}.tag`]: 1},
              {"control.min.tm": 1, "control.max.tm": 1, "meta.tag": 1},
              3);
    testIndex({
        [`${metaFieldName}.abc`]: 1,
        [`${timeFieldName}`]: -1,
    },
              {"meta.abc": 1, "control.max.tm": -1, "control.min.tm": -1},
              3);
});
}());
