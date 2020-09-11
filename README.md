<div align="center">
<img src="https://user-images.githubusercontent.com/433909/52972858-ff0e6d00-3370-11e9-9188-6b3672acec27.jpg" width="400" height="440">
</div>

Build a GraphQL schema from a given Swagger or Open API specification.

## Install
To install swagql as devDependency run:
```bash
npm i -D swagql
```

## Usage
```bash
cat swagger.yml | npx swagql [-p <babel-plugin1-path>,<babel-plugin2-path>] [-n NamePrefix_]> schema.js
```

Input swagger schema can be in YAML or JSON format. The generated schema exports
a `schema` object and two symbols `FETCH` and `VERIFY_AUTH_STATUS`. These
symbols should reside in the `context` used while creating the GraphQL server.

The definition of `VERIFY_AUTH_STATUS` symbol is optional. It is used to check
the authorization status for given request and swagger auth config. If a given
request does not satisfy the required auth status, you can throw an auth error
from this function. `requestContext` can be used to hold the information about
the current request, such as the request object itself.

In the case where you are merging multiple schemas, you may wish to have all
of the methods and types be unique, and can pass the `--name-prefix` (or `-n`)
flag to prepend the given string to all of the above.

```js
const { schema, FETCH, VERIFY_AUTH_STATUS } = require(pathToSchema);

function verifyAuthStatus(requestContext, authConfig) {
    // verify if current request satisfies authConfig for the given endpoint.
    // if not, throw an auth error.
}
const context = {
  [FETCH]: apiClient.fetch,
  [VERIFY_AUTH_STATUS]: verifyAuthStatus.bind(null, request),
};
```

Use schema and context in your app
```js
const { graphql } = require('graphql');

graphql(schema, query, context)
  .then(result => console.log(result));
```

## Pagination

If given REST API response includes lists, we need to add page info and edge
connection cursors to handle pagination in GraphQL.

To handle this, the generated schema looks for `convertArrayToConnection` and
`parseCursorOptions` function definitions in `./array-to-connection.js`. SwagQL
provides a default implementation for array-to-connection. If your APIs return
pagination information in the response, the default implementation can be used
as follows:

```js
// array-to-connection.js
module.exports = require('swagql/array-to-connection');
```

If your API responses handle pagination differently, you may have to customize
array-to-connection implementation.

## Acknowledgements

`test/fixtures/petstore.json` is taken from https://petstore.swagger.io/v2/swagger.json
