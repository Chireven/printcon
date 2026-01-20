'use client';

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  MapPin, 
  Share2, 
  MessageSquare, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Cable, 
  HardDrive, 
  Plus, 
  X,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { QuickCreatePortModal } from './QuickCreatePortModal';

interface DeviceProvisioningWizardProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  onProvisionComplete: () => void;
}

// Mock Data Interfaces (should match what Tabs use)
interface PrinterPort {
  Id: string;
  Name: string;
  IPAddress: string;
  Protocol: string;
}

interface InstalledDriver {
  Id: string;
  Name: string;
  Environment: string;
}

type Step = 'identity' | 'connectivity' | 'translation' | 'summary';

export function DeviceProvisioningWizard({ 
  isOpen, 
  onClose, 
  serverId,
  onProvisionComplete 
}: DeviceProvisioningWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isQuickPortModalOpen, setIsQuickPortModalOpen] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    shareName: '',
    location: '',
    comments: '',
    portId: '',
    driverId: ''
  });

  // Available Resources
  const [ports, setPorts] = useState<PrinterPort[]>([]);
  const [drivers, setDrivers] = useState<InstalledDriver[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Reset wizard on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('identity');
      setFormData({
        name: '',
        shareName: '',
        location: '',
        comments: '',
        portId: '',
        driverId: ''
      });
      fetchResources();
    }
  }, [isOpen, serverId]);

  const fetchResources = async () => {
    setLoading(true);
    // Mimic fetching available ports and drivers for this server
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // MOCK DATA - In production, fetch via EventHub
      setPorts([
        { Id: 'p1', Name: 'IP_192.168.1.50', IPAddress: '192.168.1.50', Protocol: 'Raw' },
        { Id: 'p2', Name: 'IP_192.168.1.51', IPAddress: '192.168.1.51', Protocol: 'LPR' },
      ]);
      
      setDrivers([
        { Id: 'd1', Name: 'HP Universal Printing PCL 6', Environment: 'x64' },
        { Id: 'd2', Name: 'Xerox Global Print Driver', Environment: 'x64' },
      ]);
      
      setDataLoaded(true);
    } catch (error) {
      toast.error('Failed to load server resources');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep === 'identity') {
      if (!formData.name) return toast.error('Printer Name is required');
      setCurrentStep('connectivity');
    } else if (currentStep === 'connectivity') {
      if (!formData.portId) return toast.error('Please select a port');
      setCurrentStep('translation');
    } else if (currentStep === 'translation') {
      if (!formData.driverId) return toast.error('Please select a driver');
      setCurrentStep('summary');
    }
  };

  const handleBack = () => {
    if (currentStep === 'summary') setCurrentStep('translation');
    else if (currentStep === 'translation') setCurrentStep('connectivity');
    else if (currentStep === 'connectivity') setCurrentStep('identity');
  };

  const handleQuickCreatePort = () => {
    setIsQuickPortModalOpen(true);
  };

  const handlePortCreated = (newPort: PrinterPort) => {
    setPorts(prev => [...prev, newPort]);
    updateField('portId', newPort.Id);
  };

  const handleProvision = async () => {
    setIsProvisioning(true);
    try {
      // Simulate provisioning delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Device Provisioned Successfully', {
        description: `${formData.name} is now active.`
      });
      
      onProvisionComplete();
      onClose();
    } catch (error) {
      toast.error('Provisioning Failed');
    } finally {
      setIsProvisioning(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    { id: 'identity', label: 'Identity', icon: Printer },
    { id: 'connectivity', label: 'Connectivity', icon: Cable },
    { id: 'translation', label: 'Translation', icon: HardDrive },
    { id: 'summary', label: 'Summary', icon: Check },
  ];

  const getStepStatus = (stepId: string, index: number) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">Device Provisioning Wizard</h2>
            <p className="text-sm text-slate-400">Assemble a new print queue</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between relative">
            {/* Progress Bar Background */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 rounded-full -z-10" />
            
            {/* Steps */}
            {steps.map((step, index) => {
              const status = getStepStatus(step.id, index);
              const isCompleted = status === 'completed';
              const isCurrent = status === 'current';
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2 bg-slate-900 px-2 z-10">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                    ${isCurrent ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/25' : ''}
                    ${status === 'pending' ? 'bg-slate-800 border-slate-700 text-slate-500' : ''}
                  `}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-medium ${isCurrent ? 'text-sky-400' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500 mb-4" />
              <p className="text-slate-400">Loading server resources...</p>
            </div>
          ) : (
            <>
              {/* STEP 1: IDENTITY */}
              {currentStep === 'identity' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Printer Name <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <Printer className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          placeholder="e.g. US_NYC_FL03_PTR01"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Share Name</label>
                      <div className="relative">
                        <Share2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={formData.shareName}
                          onChange={(e) => updateField('shareName', e.target.value)}
                          placeholder="Recommended"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input 
                        type="text" 
                        value={formData.location}
                        onChange={(e) => updateField('location', e.target.value)}
                        placeholder="e.g. New York Office, 3rd Floor"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Comments</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <textarea 
                        value={formData.comments}
                        onChange={(e) => updateField('comments', e.target.value)}
                        placeholder="Additional notes..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500 h-24 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: CONNECTIVITY */}
              {currentStep === 'connectivity' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <h4 className="text-sky-400 font-medium text-sm">Select a Communication Port</h4>
                      <p className="text-slate-400 text-xs">Choose how this device connects to the network.</p>
                    </div>
                    <button 
                      onClick={handleQuickCreatePort}
                      className="text-xs bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Quick Create
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {ports.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                        <Cable className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No ports available. Create one to continue.</p>
                      </div>
                    ) : (
                      ports.map(port => (
                        <div 
                          key={port.Id}
                          onClick={() => updateField('portId', port.Id)}
                          className={`
                            p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                            ${formData.portId === port.Id 
                              ? 'bg-sky-500/10 border-sky-500 shadow-sm shadow-sky-500/10' 
                              : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-800/80'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.portId === port.Id ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                              <Cable className="w-4 h-4" />
                            </div>
                            <div>
                              <p className={`font-medium ${formData.portId === port.Id ? 'text-white' : 'text-slate-200'}`}>{port.Name}</p>
                              <p className="text-xs text-slate-500">{port.IPAddress}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700">{port.Protocol}</span>
                            {formData.portId === port.Id && <Check className="w-5 h-5 text-sky-500" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: TRANSLATION */}
              {currentStep === 'translation' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
                    <h4 className="text-purple-400 font-medium text-sm">Select a Printing Driver</h4>
                    <p className="text-slate-400 text-xs">The driver translates documents into printer commands.</p>
                  </div>

                  {drivers.length === 0 ? (
                    <div className="text-center py-10 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                      <h4 className="text-red-400 font-medium mb-1">No Drivers Installed</h4>
                      <p className="text-slate-400 text-sm max-w-xs mx-auto mb-4">
                        You must install a driver on this server before you can provision a device.
                      </p>
                      <button className="text-xs text-slate-300 underline hover:text-white">
                        Go to Drivers Tab
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-300">Available Drivers</label>
                       <div className="grid gap-2">
                         {drivers.map(driver => (
                            <div 
                              key={driver.Id}
                              onClick={() => updateField('driverId', driver.Id)}
                              className={`
                                p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                ${formData.driverId === driver.Id
                                  ? 'bg-purple-500/10 border-purple-500 shadow-sm shadow-purple-500/10' 
                                  : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-800/80'}
                              `}
                            >
                              <div className="flex items-center gap-3">
                                <HardDrive className={`w-4 h-4 ${formData.driverId === driver.Id ? 'text-purple-400' : 'text-slate-500'}`} />
                                <span className={`text-sm font-medium ${formData.driverId === driver.Id ? 'text-white' : 'text-slate-300'}`}>
                                  {driver.Name}
                                </span>
                              </div>
                              {formData.driverId === driver.Id && <Check className="w-4 h-4 text-purple-500" />}
                            </div>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: SUMMARY */}
              {currentStep === 'summary' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-lg font-bold text-white mb-4">Review Configuration</h3>
                  
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700/50">
                    <div className="p-4 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-sky-500/10">
                        <Printer className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Identity</p>
                        <p className="text-white font-medium text-lg">{formData.name}</p>
                        {formData.shareName && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
                            <Share2 className="w-3 h-3" />
                            {formData.shareName}
                          </div>
                        )}
                        <p className="text-slate-500 text-sm mt-1">{formData.location}</p>
                      </div>
                    </div>

                    <div className="p-4 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-slate-700/10">
                        <Cable className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Port</p>
                        {(() => {
                          const port = ports.find(p => p.Id === formData.portId);
                          return (
                            <>
                              <p className="text-slate-200 font-medium">{port?.Name}</p>
                              <p className="text-slate-500 text-sm">{port?.IPAddress} ({port?.Protocol})</p>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="p-4 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-slate-700/10">
                        <HardDrive className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Driver</p>
                        <p className="text-slate-200 font-medium">
                          {drivers.find(d => d.Id === formData.driverId)?.Name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                    <Check className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <p className="text-sm text-slate-300">
                      Ready to provision. The Print Spooler service will briefly restart to finalize this configuration.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-700 bg-slate-900/50 rounded-b-xl flex justify-between items-center">
          {currentStep !== 'identity' ? (
            <button
              onClick={handleBack}
              disabled={isProvisioning}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
             <div /> // Spacer
          )}

          {currentStep === 'summary' ? (
            <button
              onClick={handleProvision}
              disabled={isProvisioning}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-lg shadow-emerald-900/20 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProvisioning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Provisioning...
                </>
              ) : (
                <>
                  Provision Device <Check className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={loading || (currentStep === 'translation' && drivers.length === 0)}
              className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all shadow-lg shadow-sky-900/20 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Create Port Modal - Rendered here to sit on top */}
        <QuickCreatePortModal
          isOpen={isQuickPortModalOpen}
          onClose={() => setIsQuickPortModalOpen(false)}
          onPortCreated={handlePortCreated}
        />

      </div>
    </div>
  );
}
