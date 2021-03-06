/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { InMemoryFile } from "@atomist/automation-client/project/mem/InMemoryFile";

import { successOn } from "@atomist/automation-client/action/ActionResult";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import { fakeRunWithLogContext } from "@atomist/sdm/util/test/fakeRunWithLogContext";
import * as assert from "power-assert";

import { executeAutofixes } from "@atomist/sdm/api-helper/listener/executeAutofixes";
import { DefaultRepoRefResolver } from "@atomist/sdm/handlers/common/DefaultRepoRefResolver";
import { SingleProjectLoader } from "@atomist/sdm/util/test/SingleProjectLoader";
import { AddAtomistTypeScriptHeader } from "../../../src/blueprint/code/autofix/addAtomistHeader";
import { ApacheHeader } from "../../../src/commands/editors/license/addHeader";

/**
 * Test an autofix end to end
 */
describe("addHeaderFix", () => {

    it("should lint and make fixes", async () => {
        const p = await GitCommandGitProject.cloned({token: null}, new GitHubRepoRef("atomist", "github-sdm"));
        // Make commit and push harmless
        let pushCount = 0;
        let commitCount = 0;
        p.commit = async () => {
            ++commitCount;
            return successOn(p);
        };
        p.push = async () => {
            ++pushCount;
            return successOn(p);
        };
        const f = new InMemoryFile("src/bad.ts", "const foo;\n");
        const pl = new SingleProjectLoader(p);
        // Now mess it up with a lint error that tslint can fix
        await p.addFile(f.path, f.content);
        assert(!!p.findFileSync(f.path));

        const r = await executeAutofixes(pl, [AddAtomistTypeScriptHeader],
            new DefaultRepoRefResolver())(fakeRunWithLogContext(p.id as RemoteRepoRef));
        assert(r.code === 1);
        assert.equal(pushCount, 1);
        assert.equal(commitCount, 1);

        const fileNow = p.findFileSync(f.path);
        assert(!!fileNow);
        assert(fileNow.getContentSync().startsWith(ApacheHeader));
    }).timeout(40000);

});
