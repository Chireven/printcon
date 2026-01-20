/**
 * Plugin: Printers Printservers
 *
 * Rule #6: Dependency Injection Only.
 * This plugin receives the PluginAPI from the Core during initialization.
 */

import { PluginInitializer } from '../../../src/core/types/plugin';

export const initialize: PluginInitializer = async (api) => {
  api.log('Info', 'Plugin printers-printservers initialized');
  console.log('Plugin printers-printservers initialized');
};
