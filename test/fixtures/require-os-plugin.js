'use strict';

module.exports = function ({ types: t }) {
  return {
    name: 'req-os',
    visitor: {
      Program(path) {
        const requireHelper = t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('os'),
            t.callExpression(t.identifier('require'), [t.stringLiteral('os')])
          ),
        ]);

        path.get(`body.0`).insertBefore(requireHelper);
      },
    },
  };
};
