### 1.3.3

* don't die on Query or Mutation without fields - **[@dbushong](https://github.com/dbushong)** [#15](https://github.com/groupon/swagql/pull/15)
  - [`e4c466f`](https://github.com/groupon/swagql/commit/e4c466f59cac15835fdddacdcc02bbee3857cb17) **fix:** don't die on Query or Mutation w/out fields


### 1.3.2

* handle invalid key names - **[@erothman-groupon](https://github.com/erothman-groupon)** [#10](https://github.com/groupon/swagql/pull/10)
  - [`93401e5`](https://github.com/groupon/swagql/commit/93401e53c6f70a7dc41237d77eb4cc8515ad6e78) **fix:** handle invalid key names
  - [`0c4752e`](https://github.com/groupon/swagql/commit/0c4752ef76613b9360b1f26c1b2a4810159a0e7b) **fix:** replace array with a set and update makeValidName
  - [`51a6511`](https://github.com/groupon/swagql/commit/51a6511a33b00001308c1a31f45ed6fc5b75c357) **fix:** do not add resolver to input types
  - [`064b821`](https://github.com/groupon/swagql/commit/064b8218c0b5899dc7d30b74eaf433af7b260e60) **fix:** do not assume type is always a string
  - [`95b0def`](https://github.com/groupon/swagql/commit/95b0def8b0e655a690c7b6838b99643734b55468) **fix:** add test for nested objects
  - [`88e1e4f`](https://github.com/groupon/swagql/commit/88e1e4f01ffbe2153fa4f5f319eec772ae16e90e) **fix:** create map fields resolve function for posts & puts
  - [`e223653`](https://github.com/groupon/swagql/commit/e223653a632554dec6b170acb0de8d1dbab0d6df) **fix:** handle nested objects in post/put resolver function


### 1.3.1

* chore(deps): bump lodash from 4.17.11 to 4.17.13 - **[@dependabot[bot]](https://github.com/apps/dependabot)** [#11](https://github.com/groupon/swagql/pull/11)
  - [`d531c20`](https://github.com/groupon/swagql/commit/d531c20c4bc4819cdffbe76d8ab901101b878f84) **chore:** bump lodash from 4.17.11 to 4.17.13 - see: [4](- [Commits](https://github.com/lodash/lodash/compare/4)


### 1.3.0

* fix & support pathitem parameters - **[@dbushong](https://github.com/dbushong)** [#9](https://github.com/groupon/swagql/pull/9)
  - [`b3b8a3e`](https://github.com/groupon/swagql/commit/b3b8a3ed7b1c0bed1f2359707269e174c20ed983) **fix:** ignore non-method pathitem entries
  - [`31e7ce1`](https://github.com/groupon/swagql/commit/31e7ce17ce3548591fe69ba05fa9fec51a5bbed8) **feat:** add support for pathitem-level params - see: [v3](http://spec.openapis.org/oas/v3)


### 1.2.0

* --name-prefix flag - **[@dbushong](https://github.com/dbushong)** [#8](https://github.com/groupon/swagql/pull/8)
  - [`966d91a`](https://github.com/groupon/swagql/commit/966d91a90e2b16df9f3847f7ace8c94b66c62a04) **feat:** --name-prefix flag


### 1.1.4

* chore: remove silly preinstall check - **[@dbushong](https://github.com/dbushong)** [#7](https://github.com/groupon/swagql/pull/7)
  - [`38bad34`](https://github.com/groupon/swagql/commit/38bad3474b367c2c58552418e9ee3e0aba8db7f6) **chore:** remove silly preinstall check
  - [`bd5a616`](https://github.com/groupon/swagql/commit/bd5a616f4f43162f891dfc4c858dc12f9b5ab46f) **fix:** use Buffer.from() instead of new Buffer()


### 1.1.3

* don't die on operationId: 'get' - **[@dbushong](https://github.com/dbushong)** [#6](https://github.com/groupon/swagql/pull/6)
  - [`3cadd1d`](https://github.com/groupon/swagql/commit/3cadd1d8d1a53dd0ffff804f54a2ceaa4724c30f) **chore:** npm audit fix
  - [`10e9335`](https://github.com/groupon/swagql/commit/10e9335d55adf828045aa59af2a56f267e8c2283) **fix:** don't die on operationId: 'get'


### 1.1.2

* add package keywords - **[@saumitrab](https://github.com/saumitrab)** [#4](https://github.com/groupon/swagql/pull/4)
  - [`7ce0f51`](https://github.com/groupon/swagql/commit/7ce0f5136a7cefc67593a1a8e6c2952439bbf278) **docs:** add package keywords


### 1.1.1

* Add array connection tests and mention usage in docs - **[@saumitrab](https://github.com/saumitrab)** [#3](https://github.com/groupon/swagql/pull/3)
  - [`66a809a`](https://github.com/groupon/swagql/commit/66a809aa4e369faf623414b6ffba62071f5bb8bc) **test:** add a test for array-to-connection
  - [`fff5685`](https://github.com/groupon/swagql/commit/fff5685fbb205e753e6b201d16def8fcc4d76a33) **docs:** mention pagination details in README


### 1.1.0

* feat: expose array-to-connections - **[@saumitrab](https://github.com/saumitrab)** [#2](https://github.com/groupon/swagql/pull/2)
  - [`c77ebce`](https://github.com/groupon/swagql/commit/c77ebced64cbd4dad5ab071af6d3d7b1b7239a9f) **feat:** expose array-to-connections


### 1.0.0

* Fix travis configs - **[@jkrems](https://github.com/jkrems)** [#1](https://github.com/groupon/swagql/pull/1)
  - [`7d4844b`](https://github.com/groupon/swagql/commit/7d4844b8e612f565a9cc269a0de3526a14d8590f) **chore:** Fix travis configs
* [`7fdab4d`](https://github.com/groupon/swagql/commit/7fdab4d7230088687d4415e2653de6debdd1daad) **chore:** Initial public release
