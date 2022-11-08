/**
 *    Copyright (C) 2022-present MongoDB, Inc.
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the Server Side Public License, version 1,
 *    as published by MongoDB, Inc.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    Server Side Public License for more details.
 *
 *    You should have received a copy of the Server Side Public License
 *    along with this program. If not, see
 *    <http://www.mongodb.com/licensing/server-side-public-license>.
 *
 *    As a special exception, the copyright holders give permission to link the
 *    code of portions of this program with the OpenSSL library under certain
 *    conditions as described in each individual source file and distribute
 *    linked combinations including the program with the OpenSSL library. You
 *    must comply with the Server Side Public License in all respects for
 *    all of the code used other than as permitted herein. If you modify file(s)
 *    with this exception, you may extend this exception to your version of the
 *    file(s), but you are not obligated to do so. If you do not wish to do so,
 *    delete this exception statement from your version. If you delete this
 *    exception statement from all source files in the program, then also delete
 *    it in the license file.
 */

#include "mongo/db/exec/sbe/expression_test_base.h"

namespace mongo::sbe {
using SBELocalBindTest = EExpressionTestFixture;

TEST_F(SBELocalBindTest, OneVariable) {
    value::ViewOfValueAccessor slotAccessor;
    FrameId frame = 10;
    auto expr = sbe::makeE<ELocalBind>(frame,
                                       makeEs(makeC(makeInt32(10))),
                                       makeE<EPrimBinary>(EPrimBinary::Op::add,
                                                          makeE<EVariable>(frame, 0),
                                                          makeE<EVariable>(frame, 0)));
    auto compiledExpr = compileExpression(*expr);
    auto [tag, val] = runCompiledExpression(compiledExpr.get());
    value::ValueGuard guard(tag, val);

    ASSERT_THAT(std::make_pair(tag, val), ValueEq(makeInt32(20)));
}

TEST_F(SBELocalBindTest, TwoVariables) {
    value::ViewOfValueAccessor slotAccessor;
    FrameId frame = 10;
    auto expr = sbe::makeE<ELocalBind>(frame,
                                       makeEs(makeC(makeInt32(10)), makeC(makeInt32(20))),
                                       makeE<EPrimBinary>(EPrimBinary::Op::add,
                                                          makeE<EVariable>(frame, 0),
                                                          makeE<EVariable>(frame, 1)));
    auto compiledExpr = compileExpression(*expr);
    auto [tag, val] = runCompiledExpression(compiledExpr.get());
    value::ValueGuard guard(tag, val);

    ASSERT_THAT(std::make_pair(tag, val), ValueEq(makeInt32(30)));
}

TEST_F(SBELocalBindTest, NestedBind1) {
    value::ViewOfValueAccessor slotAccessor;
    FrameId frame1 = 10;
    FrameId frame2 = 20;
    auto bindExpr = sbe::makeE<ELocalBind>(frame1,
                                           makeEs(makeC(makeInt32(10))),
                                           makeE<EPrimBinary>(EPrimBinary::Op::add,
                                                              makeE<EVariable>(frame1, 0),
                                                              makeE<EVariable>(frame2, 0)));

    auto expr = sbe::makeE<ELocalBind>(
        frame2,
        makeEs(makeC(makeInt32(20))),
        makeE<EPrimBinary>(EPrimBinary::Op::add, std::move(bindExpr), makeE<EVariable>(frame2, 0)));

    auto compiledExpr = compileExpression(*expr);
    auto [tag, val] = runCompiledExpression(compiledExpr.get());
    value::ValueGuard guard(tag, val);

    ASSERT_THAT(std::make_pair(tag, val), ValueEq(makeInt32(50)));
}

TEST_F(SBELocalBindTest, NestedBind2) {
    value::ViewOfValueAccessor slotAccessor;
    FrameId frame1 = 10;
    FrameId frame2 = 20;
    auto bindExpr = sbe::makeE<ELocalBind>(frame1,
                                           makeEs(makeC(makeInt32(10)), makeC(makeInt32(20))),
                                           makeE<EPrimBinary>(EPrimBinary::Op::add,
                                                              makeE<EVariable>(frame1, 0),
                                                              makeE<EVariable>(frame1, 1)));

    auto expr = sbe::makeE<ELocalBind>(frame2,
                                       makeEs(std::move(bindExpr), makeC(makeInt32(30))),
                                       makeE<EPrimBinary>(EPrimBinary::Op::add,
                                                          makeE<EVariable>(frame2, 0),
                                                          makeE<EVariable>(frame2, 1)));

    auto compiledExpr = compileExpression(*expr);
    auto [tag, val] = runCompiledExpression(compiledExpr.get());
    value::ValueGuard guard(tag, val);

    ASSERT_THAT(std::make_pair(tag, val), ValueEq(makeInt32(60)));
}

}  // namespace mongo::sbe
