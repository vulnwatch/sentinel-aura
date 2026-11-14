# Changelog

## [0.8.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.7.0...v0.8.0) (2026-11-14)


### Features

* **deps:** pin Sentinel 0.22.0 and follow its example dataset ([#224](https://github.com/vulnwatch/sentinel-aura/issues/224)) ([3b4c1bf](https://github.com/vulnwatch/sentinel-aura/commit/3b4c1bf35d219fde842032c8f1256d8afd2588f2))
* **deps:** pin Sentinel 0.23.0 ([#244](https://github.com/vulnwatch/sentinel-aura/issues/244)) ([a829f2b](https://github.com/vulnwatch/sentinel-aura/commit/a829f2b54be93379d0e59622464823276f885208))
* pick the dates of the audit log period from a calendar ([#235](https://github.com/vulnwatch/sentinel-aura/issues/235)) ([83627e5](https://github.com/vulnwatch/sentinel-aura/commit/83627e52855a3dd94e961588d799c6d00954921c))
* refine the CVSS assessments of a Ticket ([#231](https://github.com/vulnwatch/sentinel-aura/issues/231)) ([b6c62f4](https://github.com/vulnwatch/sentinel-aura/commit/b6c62f4c6c0f9ae5101550eb7809160f771b154c))
* show and edit the references of a Ticket ([#245](https://github.com/vulnwatch/sentinel-aura/issues/245)) ([7a59e29](https://github.com/vulnwatch/sentinel-aura/commit/7a59e290825f97951ae0df5f42344ef7f36c41dc))
* show each track of the package tree on one line ([#242](https://github.com/vulnwatch/sentinel-aura/issues/242)) ([c5c5db2](https://github.com/vulnwatch/sentinel-aura/commit/c5c5db2efeb113c606927ab1e984c6c71b682250))
* show the affected versions of a Ticket's CVE ([#249](https://github.com/vulnwatch/sentinel-aura/issues/249)) ([78832c3](https://github.com/vulnwatch/sentinel-aura/commit/78832c35f881eb8427882b3c3370e835c08a8f39))
* show the audit log of a Ticket ([#233](https://github.com/vulnwatch/sentinel-aura/issues/233)) ([1aa65ec](https://github.com/vulnwatch/sentinel-aura/commit/1aa65ec5db0daa9967c6385dadee997446d434e9))
* show the CNA of a Ticket's CVE ([#232](https://github.com/vulnwatch/sentinel-aura/issues/232)) ([ae3688e](https://github.com/vulnwatch/sentinel-aura/commit/ae3688e35e064ee243cca2fbe978a84a399394cd))
* show the CVSS assessments of a Ticket's CVE ([#226](https://github.com/vulnwatch/sentinel-aura/issues/226)) ([cb494e5](https://github.com/vulnwatch/sentinel-aura/commit/cb494e5726615e5ec5374022901e8333aa031885))
* show the override provenance after the evidence of a priority ([#191](https://github.com/vulnwatch/sentinel-aura/issues/191)) ([dccb677](https://github.com/vulnwatch/sentinel-aura/commit/dccb677d95e92e5df2889e719e0109c39fe6ee92)), closes [#190](https://github.com/vulnwatch/sentinel-aura/issues/190)
* show the package tree of a Ticket ([#222](https://github.com/vulnwatch/sentinel-aura/issues/222)) ([679b805](https://github.com/vulnwatch/sentinel-aura/commit/679b8054836659f364cf9abb0921633ad09cf212))
* show the participants and the access grants of a Ticket ([#237](https://github.com/vulnwatch/sentinel-aura/issues/237)) ([342b6d6](https://github.com/vulnwatch/sentinel-aura/commit/342b6d681833390cf59d1c614d57e41f6e436e04))
* show the read-only detail of a Ticket ([#221](https://github.com/vulnwatch/sentinel-aura/issues/221)) ([7c3bec3](https://github.com/vulnwatch/sentinel-aura/commit/7c3bec31655b1a683c4c1f41a1183e2870b94098))
* show the Slack profile picture as the avatar of a user ([#250](https://github.com/vulnwatch/sentinel-aura/issues/250)) ([91a600f](https://github.com/vulnwatch/sentinel-aura/commit/91a600f9409c47d0d75e2ea28ed676b2943ff0dd))
* show the sources of a Ticket's CVE with Refetch ([#227](https://github.com/vulnwatch/sentinel-aura/issues/227)) ([671b807](https://github.com/vulnwatch/sentinel-aura/commit/671b8073478f14c1ec2c61e6a9bcc64a924b4abe))
* show who set the eligibility of a Product by hand ([#247](https://github.com/vulnwatch/sentinel-aura/issues/247)) ([a78c245](https://github.com/vulnwatch/sentinel-aura/commit/a78c2456bb4a1c85e2a041c6b9fdeeeec9cd6aaf))


### Dependencies

* **deps:** Update dependency orval to v8.46.0 ([#177](https://github.com/vulnwatch/sentinel-aura/issues/177)) ([6e1b06d](https://github.com/vulnwatch/sentinel-aura/commit/6e1b06d7f51bae1b9e0a679db5c1a5853815c8c9))
* **deps:** Update nginx ([#196](https://github.com/vulnwatch/sentinel-aura/issues/196)) ([8d43894](https://github.com/vulnwatch/sentinel-aura/commit/8d438949a0de161864ba02174e5cad433ff220f4))
* **deps:** Update npm minor and patch dependencies ([#157](https://github.com/vulnwatch/sentinel-aura/issues/157)) ([63a19e1](https://github.com/vulnwatch/sentinel-aura/commit/63a19e19d8ad22d082ce45c0b19eea61f909bab1))
* **deps:** Update postgres Docker digest to e3d24f6 ([#175](https://github.com/vulnwatch/sentinel-aura/issues/175)) ([9ca348c](https://github.com/vulnwatch/sentinel-aura/commit/9ca348c2ab3b4a34fe81e5f08e202b490222faac))

## [0.7.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.6.0...v0.7.0) (2026-11-08)


### Features

* align the sidebar, landing, and Ticket list with the screen map ([#178](https://github.com/vulnwatch/sentinel-aura/issues/178)) ([f1c631a](https://github.com/vulnwatch/sentinel-aura/commit/f1c631a657b344b22ef9a71c93a57e77c195156d))
* **deps:** pin Sentinel 0.19.0 and follow the embargo deadlines ([#182](https://github.com/vulnwatch/sentinel-aura/issues/182)) ([f4a542e](https://github.com/vulnwatch/sentinel-aura/commit/f4a542e683518fa52ec1c01db01357dc3c7a5401))
* **deps:** pin Sentinel 0.20.0 and follow the override provenance ([#187](https://github.com/vulnwatch/sentinel-aura/issues/187)) ([5d13c5d](https://github.com/vulnwatch/sentinel-aura/commit/5d13c5ddcfd3159a3c79520c139af5babe5651a3)), closes [#186](https://github.com/vulnwatch/sentinel-aura/issues/186)
* explain the priority of a Ticket in the Ticket list ([#185](https://github.com/vulnwatch/sentinel-aura/issues/185)) ([4416c85](https://github.com/vulnwatch/sentinel-aura/commit/4416c851c44bb5a7f17e1d776e64fc3cdb731f7e))
* show the Embargo view and its count in the Ticket list ([#183](https://github.com/vulnwatch/sentinel-aura/issues/183)) ([4a8aa54](https://github.com/vulnwatch/sentinel-aura/commit/4a8aa544e89fbb8bcd566375b735967c521a958a))
* show who set the priority override of a Ticket and when ([#188](https://github.com/vulnwatch/sentinel-aura/issues/188)) ([f11900a](https://github.com/vulnwatch/sentinel-aura/commit/f11900ae0e3a54ff1441964429e8587a23d8a4d2)), closes [#184](https://github.com/vulnwatch/sentinel-aura/issues/184)

## [0.6.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.5.0...v0.6.0) (2026-11-05)


### Features

* **deps:** pin Sentinel 0.18.0 and mute the rest of a +N tooltip ([#163](https://github.com/vulnwatch/sentinel-aura/issues/163)) ([000cb2b](https://github.com/vulnwatch/sentinel-aura/commit/000cb2b97586ab97013a11ae925e1264ef21ed00)), closes [#162](https://github.com/vulnwatch/sentinel-aura/issues/162)
* rename the Orphaned view to Unassigned and group the queues ([#160](https://github.com/vulnwatch/sentinel-aura/issues/160)) ([4f5af39](https://github.com/vulnwatch/sentinel-aura/commit/4f5af3921eec5cf116c76dcb1870f3bc0a60f5ab))

## [0.5.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.4.0...v0.5.0) (2026-11-04)


### Features

* add Sign in and the session handling ([#127](https://github.com/vulnwatch/sentinel-aura/issues/127)) ([7d55d62](https://github.com/vulnwatch/sentinel-aura/commit/7d55d62c5d7a433f319b69a752e5e89dd1e0fbae))
* add the design tokens, the themes, Inter, and Lucide ([#114](https://github.com/vulnwatch/sentinel-aura/issues/114)) ([8406325](https://github.com/vulnwatch/sentinel-aura/commit/8406325d0e37d44a818bba751312fabcd7a9d70e)), closes [#113](https://github.com/vulnwatch/sentinel-aura/issues/113)
* add the sidebar, the account menu, and Sign out ([#135](https://github.com/vulnwatch/sentinel-aura/issues/135)) ([402968f](https://github.com/vulnwatch/sentinel-aura/commit/402968fecd394bedbc8e522a531a7c9f7dc4eea5))
* **deps:** pin Sentinel 0.16.0 and sort the queues by deadline ([#148](https://github.com/vulnwatch/sentinel-aura/issues/148)) ([755bcca](https://github.com/vulnwatch/sentinel-aura/commit/755bcca484ab9739aadd8ab9b95c8ec0b648ae88))
* **deps:** pin Sentinel 0.17.0 and follow assignment eligibility ([#153](https://github.com/vulnwatch/sentinel-aura/issues/153)) ([956dc07](https://github.com/vulnwatch/sentinel-aura/commit/956dc07da71bbea67ffb31ace96e4eec4f312c6d))
* list Tickets in their views, with their counts and pages ([#146](https://github.com/vulnwatch/sentinel-aura/issues/146)) ([82f088f](https://github.com/vulnwatch/sentinel-aura/commit/82f088f82b93b3b02a56d29272a1b44e6f823d0f))
* present errors and loading, and show Not found ([#121](https://github.com/vulnwatch/sentinel-aura/issues/121)) ([d280750](https://github.com/vulnwatch/sentinel-aura/commit/d28075056f980020464ae5ffe04c08aa020d0597))
* present the severity, priority, status, and deadline of Tickets ([#144](https://github.com/vulnwatch/sentinel-aura/issues/144)) ([89d74dd](https://github.com/vulnwatch/sentinel-aura/commit/89d74ddfc73f140cf031e7bed040050387f4e6ad))
* represent every user with a generated avatar ([#133](https://github.com/vulnwatch/sentinel-aura/issues/133)) ([71679f4](https://github.com/vulnwatch/sentinel-aura/commit/71679f428fc9ccde5d7952f5be8cc76bd65afc2a))
* search, filter, and sort Tickets, with the attention summary ([#150](https://github.com/vulnwatch/sentinel-aura/issues/150)) ([7225fc1](https://github.com/vulnwatch/sentinel-aura/commit/7225fc167fe182c4b11b60e02ed35cac508f1241))

## [0.4.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.3.0...v0.4.0) (2026-11-01)


### Features

* **deps:** pin Sentinel 0.14.0 and align the UI documents ([#95](https://github.com/vulnwatch/sentinel-aura/issues/95)) ([d670531](https://github.com/vulnwatch/sentinel-aura/commit/d67053166c8d1db6ff4f7b367950cf4405a9eb08))
* **deps:** pin Sentinel 0.15.0 and align the UI documents ([#112](https://github.com/vulnwatch/sentinel-aura/issues/112)) ([b580803](https://github.com/vulnwatch/sentinel-aura/commit/b580803c402a1ed28f31a540dec2e5222f1c4adc))
* show the Sentinel mark and name in the browser tab ([#104](https://github.com/vulnwatch/sentinel-aura/issues/104)) ([6507930](https://github.com/vulnwatch/sentinel-aura/commit/6507930b0a9aaa16e533aa8e23392ddbdecec07e)), closes [#103](https://github.com/vulnwatch/sentinel-aura/issues/103)

## [0.3.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.2.0...v0.3.0) (2026-10-29)


### Features

* pin Sentinel 0.13.0 and honor its client obligations ([#81](https://github.com/vulnwatch/sentinel-aura/issues/81)) ([403d846](https://github.com/vulnwatch/sentinel-aura/commit/403d846ad043e72d5910917f99c86639a69f820f))


### Bug Fixes

* **deps:** update seroval for open advisories ([#86](https://github.com/vulnwatch/sentinel-aura/issues/86)) ([859f58a](https://github.com/vulnwatch/sentinel-aura/commit/859f58a7c38c55f62da19ecdabd6311130334eec)), closes [#85](https://github.com/vulnwatch/sentinel-aura/issues/85)

## [0.2.0](https://github.com/vulnwatch/sentinel-aura/compare/v0.1.1...v0.2.0) (2026-10-26)


### Features

* support Sentinel releases compatible with the pinned version ([#74](https://github.com/vulnwatch/sentinel-aura/issues/74)) ([38f2cd6](https://github.com/vulnwatch/sentinel-aura/commit/38f2cd6ad3bb26e23175833d92b93b33c6b41d7d)), closes [#72](https://github.com/vulnwatch/sentinel-aura/issues/72)

## [0.1.1](https://github.com/vulnwatch/sentinel-aura/compare/v0.1.0...v0.1.1) (2026-10-26)


### Bug Fixes

* **deps:** move the base image to docker.io/nginx/nginx-unprivileged ([#63](https://github.com/vulnwatch/sentinel-aura/issues/63)) ([63b3a72](https://github.com/vulnwatch/sentinel-aura/commit/63b3a72aebbba7ea01d289f7348dd3853e41a155)), closes [#62](https://github.com/vulnwatch/sentinel-aura/issues/62)

## 0.1.0 (2026-10-25)


### Bug Fixes

* **deps:** update fast-uri and override undici for open advisories ([#40](https://github.com/vulnwatch/sentinel-aura/issues/40)) ([b826204](https://github.com/vulnwatch/sentinel-aura/commit/b826204a435b9eb509dd3ae38984f79cbc4310ad)), closes [#39](https://github.com/vulnwatch/sentinel-aura/issues/39)
