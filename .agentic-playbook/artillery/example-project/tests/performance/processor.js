const crypto = require("crypto");

function setRandomUser(context, events, done) {
  const id = crypto.randomUUID();
  context.vars.email = `loadtest+${id}@example.com`;
  context.vars.password = process.env.LOAD_TEST_PASSWORD || "password1234";
  context.vars.itemTitle = `artillery-item-${id}`;
  context.vars.itemDescription = "Created by the Artillery onboarding example";
  return done();
}

function addRequestHeaders(requestParams, context, events, done) {
  requestParams.headers = requestParams.headers || {};
  requestParams.headers["x-request-id"] = crypto.randomUUID();
  requestParams.headers["x-load-test-run-id"] =
    process.env.LOAD_TEST_RUN_ID || "local-manual-run";
  return done();
}

module.exports = {
  setRandomUser,
  addRequestHeaders,
};
