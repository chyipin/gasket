const sinon = require('sinon');
const assume = require('assume');
const proxyquire = require('proxyquire');
const ConfigBuilder = require('../../../../src/scaffold/config-builder');

describe('promptHooks', () => {
  let sandbox, mockImports, mockContext, promptHooks;
  let engineStub, pkgAddSpy, execWaterfallStub, installStub, linkStub, promptStub, createPromptModuleStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    execWaterfallStub = sandbox.stub().resolves();
    installStub = sandbox.stub();
    linkStub = sandbox.stub();
    promptStub = sandbox.stub();
    createPromptModuleStub = sandbox.stub().returns(promptStub);

    mockContext = {
      appName: 'my-app',
      dest: '/some/path/my-app',
      presets: ['gasket-preset-bogus'],
      plugins: ['gasket-plugin-bogus-A', 'gasket-plugin-bogus-B'],
      pkg: ConfigBuilder.createPackageJson({
        name: 'my-app',
        version: '0.0.0'
      }),
      pkgManager: {
        install: installStub,
        link: linkStub,
        info: sinon.stub().callsFake(() => ({ data: '7.8.9-faked' }))
      },
      prompts: true
    };

    engineStub = sandbox.stub().returns({ execWaterfall: execWaterfallStub });

    mockImports = {
      '../create-engine': engineStub,
      'inquirer': {
        createPromptModule: createPromptModuleStub
      },
      '../action-wrapper': require('../../../helpers').mockActionWrapper
    };

    pkgAddSpy = sandbox.spy(mockContext.pkg, 'add');

    promptHooks = proxyquire('../../../../src/scaffold/actions/prompt-hooks', mockImports);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('is decorated action', async () => {
    assume(promptHooks).property('wrapped');
  });

  it('executes the plugin prompt hook with context', async () => {
    await promptHooks(mockContext);
    assume(execWaterfallStub).is.calledWithMatch('prompt', mockContext);
  });

  it('executes the plugin prompt hook with `prompt` util', async () => {
    await promptHooks(mockContext);
    assume(execWaterfallStub.args[0][2]).property('prompt', promptStub);
  });

  it('executes the plugin prompt hook with `addPlugins` util', async () => {
    await promptHooks(mockContext);
    assume(execWaterfallStub.args[0][2]).property('addPlugins');
  });

  it('does not execute the plugin prompt hook with --no-prompts', async () => {
    mockContext.prompts = false;
    await promptHooks(mockContext);
    assume(execWaterfallStub.args[0][2].prompt).is.a('function');
    assume(execWaterfallStub.args[0][2].prompt).not.equals(promptStub);
  });

  describe('addPlugins', () => {
    async function mockAddPlugins(...pluginsToAdd) {
      await promptHooks(mockContext);
      //
      // access the addPlugins created with context
      //
      const addPlugins = execWaterfallStub.args[0][2].addPlugins;
      await addPlugins(...pluginsToAdd);
    }

    it('adds new plugins to context', async () => {
      await mockAddPlugins('@gasket/plugin-jest');
      assume(mockContext.plugins).contains('@gasket/jest');
    });

    it('adds new plugins to pkg', async () => {
      await mockAddPlugins('@gasket/plugin-jest');
      assume(pkgAddSpy).is.calledWith('dependencies', { '@gasket/plugin-jest': '^7.8.9-faked' });
    });

    it('adds new plugins to pkg with version', async () => {
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(pkgAddSpy).is.calledWith('dependencies', { '@gasket/plugin-jest': '^1.2.3' });
    });

    it('installs new packages', async () => {
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(installStub).is.calledWith(['@gasket/plugin-jest@^1.2.3']);
    });

    it('re-links packages', async () => {
      mockContext.pkgLinks = ['@gasket/plugin-bogus'];
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(linkStub).is.calledWith(['@gasket/plugin-bogus']);
    });

    it('does not re-link if no package links', async () => {
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(linkStub).not.called();
    });

    it('does not install packages if marked as linked', async () => {
      mockContext.pkgLinks = ['@gasket/plugin-jest'];
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(installStub).not.called();
    });

    it('re-instantiates PluginEngine with only newly added plugins', async () => {
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(engineStub).calledWithMatch({ plugins: ['@gasket/jest'] });
    });

    it('re-executes the plugin prompt hook', async () => {
      await mockAddPlugins('@gasket/plugin-jest@^1.2.3');
      assume(execWaterfallStub).is.called(2);
    });
  });
});
