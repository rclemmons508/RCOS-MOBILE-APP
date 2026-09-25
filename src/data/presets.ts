import { IndustryPreset } from '../types';

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: 'cleaning',
    name: 'Cleaning & Maid Services',
    description: 'Residential, commercial, deep cleaning, and solo/home-based operators.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Standard Clean', 'Deep Clean', 'Move-in/Move-out Clean', 'Office Sanitation', 'Window & Baseboard Add-on'],
    recommendedTone: 'Friendly, warm, dependable, and sparkling clean',
    technicianRoleName: 'Cleaning Specialist',
    sampleJobPacks: [
      {
        id: 'jp_deep_clean',
        serviceType: 'Deep Clean',
        industry: 'cleaning',
        checklist: [
          'Kitchen: degrease stove backsplash, clean inside microwave, exterior cabinets',
          'Bathrooms: scrub tile grout, disinfect toilets, polish mirrors and chrome fixtures',
          'Living & Bedrooms: dust ceiling fans, baseboards, door frames, vacuum under furniture',
          'Floors: high-traffic vacuum followed by microfiber disinfectant mop'
        ],
        workflowSequence: {
          preCheck: ['Confirm pet status and client access code/lockbox', 'Inspect rooms for existing scratches or fragile decor', 'Air out rooms if heavy degreasers will be applied'],
          execute: ['Top-to-bottom dusting', 'Kitchen deep scrubbing', 'Bathroom sanitary sterilization', 'Floor washing from furthest room towards exit'],
          cleanUp: ['Empty and double-bag all trash cans', 'Launder dirty microfibers separately', 'Check that all interior lights are turned off as requested'],
          clientConfirmation: ['Leave scent card / checklist', 'Send digital completion walkthrough with before/after photos']
        },
        requiredTools: ['HEPA vacuum', 'Color-coded microfiber towels', 'Grout brush', 'Non-toxic disinfectant', 'Telescopic duster'],
        safetyNotes: ['Never mix bleach and ammonia products', 'Wear anti-slip shoes when mopping tiled surfaces', 'Test hidden spots before applying oven cleaners'],
        troubleshootingNotes: ['If stubborn hard water stains remain, apply vinegar soak for 15 mins before abrasive scrubbing']
      }
    ]
  },
  {
    id: 'handyman',
    name: 'Handyman & Home Repair',
    description: 'General repairs, fixture installation, drywall, carpentry, and electrical fixes.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Drywall Patch & Paint', 'Door & Lock Replacement', 'Fixture & Fan Mounting', 'Plumbing Leak Fix', 'Cabinet Hardware & Shelving'],
    recommendedTone: 'Direct, honest, highly capable, and practical',
    technicianRoleName: 'Lead Handyman',
    sampleJobPacks: [
      {
        id: 'jp_drywall_repair',
        serviceType: 'Drywall Patch & Paint',
        industry: 'handyman',
        checklist: [
          'Inspect moisture behind damaged drywall',
          'Cut clean square around hole and secure backing lumber',
          'Fasten new sheetrock patch with drywall screws',
          'Apply fiberglass mesh tape and feather 2-3 coats of joint compound',
          'Sand smooth, prime patch, and paint blend with wall'
        ],
        workflowSequence: {
          preCheck: ['Locate studs and hidden wiring using stud finder', 'Lay drop cloth over carpet or wood floor', 'Check paint code match with homeowner'],
          execute: ['Square out hole', 'Install backing block', 'Screw in sheetrock', 'Mud, tape, and feather joint compound', 'Sand and touch-up paint'],
          cleanUp: ['Vacuum drywall dust with shop vac', 'Wipe down surrounding baseboards', 'Pack tools and seal unused paint cans'],
          clientConfirmation: ['Walk homeowner through seamless finish', 'Have homeowner touch surface once cured and confirm satisfaction']
        },
        requiredTools: ['Keyhole saw', 'Cordless drill & drywall screws', '6-inch & 10-inch taping knives', 'Sanding sponge (220 grit)', 'Stud finder'],
        safetyNotes: ['Turn off breaker if working within 12 inches of wall outlets', 'Wear N95 respirator mask while sanding joint compound'],
        troubleshootingNotes: ['If previous paint coat does not match, blend feathering out 18 inches in feathered strokes']
      }
    ]
  },
  {
    id: 'landscaping',
    name: 'Landscaping & Lawn Care',
    description: 'Lawn maintenance, mulching, seasonal cleanup, irrigation, and tree trimming.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Weekly Mow & Edge', 'Spring/Fall Cleanup', 'Mulch & Bed Weeding', 'Hedge & Shrub Trimming', 'Aeration & Overseeding'],
    recommendedTone: 'Polite, active, proud of craftsmanship, and punctual',
    technicianRoleName: 'Crew Foreman',
    sampleJobPacks: [
      {
        id: 'jp_mow_edge',
        serviceType: 'Weekly Mow & Edge',
        industry: 'landscaping',
        checklist: [
          'Pick up lawn debris, toys, and fallen twigs',
          'Mow lawn at appropriate seasonal deck height (3.5 - 4 inches)',
          'String trim along fences, foundations, and trees without girdling bark',
          'Blade edge driveway, walkways, and garden curbs',
          'Blow all clippings off paved areas back into turf'
        ],
        workflowSequence: {
          preCheck: ['Inspect yard for pet waste or hidden sprinkler heads', 'Confirm back gate is latched'],
          execute: ['Mowing striped passes', 'Precision perimeter string trimming', 'Crisp vertical edging along concrete'],
          cleanUp: ['Blow patio, driveway, and front porch clean', 'Close and latch rear fence gate securely'],
          clientConfirmation: ['Snap front & backyard proof photo', 'Send auto-notification that lawn is pristine and pets safe']
        },
        requiredTools: ['Commercial zero-turn/walk-behind mower', 'Gas/battery string trimmer', 'Stick edger', 'Backpack blower'],
        safetyNotes: ['Eye and ear protection mandatory at all times', 'Check slope stability before riding mowers near ditches'],
        troubleshootingNotes: ['If turf is saturated with morning rain, delay mowing or use light push mower to prevent rutting']
      }
    ]
  },
  {
    id: 'painting',
    name: 'Painting & Staining',
    description: 'Interior painting, exterior coatings, cabinet refinishing, and deck staining.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Interior Room Painting', 'Exterior House Painting', 'Cabinet Refinishing', 'Deck Staining & Sealing', 'Trim & Molding Enamel'],
    recommendedTone: 'Artisanal, meticulous, neat, and detail-obsessed',
    technicianRoleName: 'Lead Painter',
    sampleJobPacks: [
      {
        id: 'jp_interior_paint',
        serviceType: 'Interior Room Painting',
        industry: 'painting',
        checklist: [
          'Move furniture to center of room and drape plastic',
          'Mask trim, baseboards, and window frames with painter tape',
          'Spackle nail holes and caulk baseboard gaps',
          'Cut in ceiling and corners with angled sash brush',
          'Roll two even coats of premium latex with uniform stipple'
        ],
        workflowSequence: {
          preCheck: ['Verify paint color swatch against client contract', 'Check room humidity and lighting conditions'],
          execute: ['Surface prep & taping', 'First coat cut & roll', 'Drying check (2 hours)', 'Second coat cut & roll'],
          cleanUp: ['Carefully peel tape at 45 degree angle before paint fully cures', 'Remove drop cloths without stirring dust', 'Put switch plates back on'],
          clientConfirmation: ['Inspect room with client under bright flashlight for holidays or flashing', 'Label leftover paint can for homeowner']
        },
        requiredTools: ['2.5-inch angled sash brush', '9-inch roller frame & 3/8-inch nap sleeves', 'Heavy canvas drop cloths', 'Quick-release painter tape'],
        safetyNotes: ['Maintain proper ventilation throughout drying cycle', 'Use ladder levelers when cutting tall staircases'],
        troubleshootingNotes: ['If wall shows roller lap marks, maintain a wet edge and roll floor-to-ceiling in continuous strokes']
      }
    ]
  },
  {
    id: 'pressure_washing',
    name: 'Pressure Washing & Soft Washing',
    description: 'Driveway concrete cleaning, house siding soft wash, roof wash, and deck restoration.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Driveway & Sidewalk Wash', 'House Siding Soft Wash', 'Roof Moss Treatment', 'Fence & Deck Rejuvenation', 'Commercial Storefront Cleaning'],
    recommendedTone: 'Energetic, pristine, safety-conscious, and transformative',
    technicianRoleName: 'Wash Technician',
    sampleJobPacks: [
      {
        id: 'jp_driveway_wash',
        serviceType: 'Driveway & Sidewalk Wash',
        industry: 'pressure_washing',
        checklist: [
          'Pre-wet all surrounding grass, shrubs, and flower beds with fresh water',
          'Pre-treat oil stains with degreaser and scrub with stiff broom',
          'Apply mild surfactant / algaecide pre-treatment to loosen deep grime',
          'Run rotary surface cleaner in steady overlapping grid lines',
          'Rinse dirty slurry toward street drain with high-volume wand',
          'Post-treat with light fungicide to prevent rapid mold recurrence'
        ],
        workflowSequence: {
          preCheck: ['Inspect concrete for spalling or loose expansion joints', 'Cover exterior power outlets with waterproof wrap'],
          execute: ['Vegetation soaking', 'Surface cleaner passes', 'Slurry flush rinse', 'Post-treatment spray'],
          cleanUp: ['Re-rinse all surrounding vegetation', 'Untape outlets and stow high-pressure hoses cleanly'],
          clientConfirmation: ['Show dramatic before/after contrast', 'Caution client that wet concrete remains slick for 1 hour']
        },
        requiredTools: ['4000 PSI commercial pressure washer', '20-inch rotary surface cleaner', 'Chemical injector', 'Garden hose splitter'],
        safetyNotes: ['Never point spray wand at living tissue or fragile glass', 'Wear steel-toe waterproof rubber boots and eye shield'],
        troubleshootingNotes: ['If surface cleaner leaves swirl zebra stripes, slow walking pace and check tip nozzles for grit blockages']
      }
    ]
  },
  {
    id: 'hvac',
    name: 'HVAC Services',
    description: 'Heating, ventilation, air conditioning installation, diagnostics, and preventative tune-ups.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['AC Diagnostic & Repair', 'Furnace Seasonal Tune-up', 'Heat Pump System Install', 'Duct Inspection & Air Quality', 'Thermostat Smart Setup'],
    recommendedTone: 'Technical, reassuring, precise, and safety-rigorous',
    technicianRoleName: 'HVAC Certified Technician',
    sampleJobPacks: [
      {
        id: 'jp_ac_tuneup',
        serviceType: 'AC Diagnostic & Repair',
        industry: 'hvac',
        checklist: [
          'Inspect high and low voltage disconnect switches',
          'Measure capacitor microfarad capacitance against rated tolerance',
          'Clean condenser coils with biodegradable foaming cleanser',
          'Check refrigerant pressures and subcooling / superheat calculations',
          'Flush condensate drain line and test float safety switch',
          'Measure supply vs return temperature split (16-20°F delta-T target)'
        ],
        workflowSequence: {
          preCheck: ['Lockout electrical disconnect at outdoor unit', 'Inspect indoor air filter condition'],
          execute: ['Electrical component diagnostic', 'Coil cleaning and washdown', 'Refrigerant thermodynamic check', 'Airflow check'],
          cleanUp: ['Replace service panel screws', 'Clean drain pan area', 'Verify outdoor disconnect cover is latched'],
          clientConfirmation: ['Present digital diagnostic sheet showing amp draws and delta-T', 'Review warranty coverage with homeowner']
        },
        requiredTools: ['Digital manifold gauges', 'Clamp multimeter with inrush capacity', 'Fin comb', 'Condensate pump / nitrogen blow gun'],
        safetyNotes: ['High voltage discharge risks on dual-run capacitors; always discharge with 20k ohm resistor before touch', 'Handle refrigerants strictly per EPA Section 608 guidelines'],
        troubleshootingNotes: ['If delta-T is under 14°F, check for restricted return airflow before suspecting refrigerant leak']
      }
    ]
  },
  {
    id: 'roofing',
    name: 'Roofing & Gutters',
    description: 'Roof inspections, shingle repairs, gutter cleaning, storm damage, and full replacements.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Roof Leak Inspection', 'Gutter Cleaning & Guards', 'Shingle Repair & Ridge Cap', 'Storm Damage Assessment', 'Full Reroof Estimate'],
    recommendedTone: 'Vigilant, safety-first, durable, and transparent',
    technicianRoleName: 'Roof Inspector / Specialist',
    sampleJobPacks: [
      {
        id: 'jp_roof_inspection',
        serviceType: 'Roof Leak Inspection',
        industry: 'roofing',
        checklist: [
          'Inspect attic interior for water stains, mold, or daylight through decking',
          'Inspect valley flashing and chimney counter-flashing integrity',
          'Check pipe boots and neoprene collars for UV dry rot cracks',
          'Examine shingle granule loss and wind lift creases',
          'Photograph all identified vulnerability zones'
        ],
        workflowSequence: {
          preCheck: ['Set ladder at 4:1 slope with tie-off stabilizer', 'Inspect pitch and assess harness anchor points'],
          execute: ['Ground perimeter inspection', 'Eaves and gutter check', 'High-risk flashing inspection', 'Photo documentation'],
          cleanUp: ['Sweep magnetic roller around yard for loose nails', 'Secure ladder safely'],
          clientConfirmation: ['Review high-res inspection photos with homeowner on tablet', 'Provide written recommendation and warranty options']
        },
        requiredTools: ['Pitch gauge', 'Inspection drone / high-res camera', 'Chalk marker', 'Magnetic sweeper', 'Fall arrest harness'],
        safetyNotes: ['Never step on wet moss or steep pitches without active fall arrest system', 'Watch for overhead electrical service lines'],
        troubleshootingNotes: ['If attic stain is 5 feet away from exterior leak, trace water along rafter angle before tearing open shingles']
      }
    ]
  },
  {
    id: 'construction',
    name: 'Construction & Specialty Trades',
    description: 'Framing, drywall, electrical, plumbing, masonry, concrete, and commercial contracting.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Framing & Structural', 'Concrete Pour & Finish', 'Electrical Rough-in', 'Commercial Tenant Buildout', 'Safety & Code Inspection'],
    recommendedTone: 'Authoritative, code-compliant, disciplined, and safety-focused',
    technicianRoleName: 'Site Foreman',
    sampleJobPacks: [
      {
        id: 'jp_code_inspection',
        serviceType: 'Safety & Code Inspection',
        industry: 'construction',
        checklist: [
          'Verify posted building permits and OSHA signage',
          'Inspect scaffolding guardrails and toe boards',
          'Examine load-bearing anchor bolts and shear wall nailing patterns',
          'Check fire-stopping caulk around pipe and cable penetrations',
          'Verify GFCI protection on all temporary power distribution boxes'
        ],
        workflowSequence: {
          preCheck: ['Review stamped architectural blueprints', 'Hold morning site safety briefing with subcontractors'],
          execute: ['Walk perimeter structural points', 'Review mechanical rough-ins', 'Check electrical tie-ins', 'Document punch-list'],
          cleanUp: ['Tag out non-compliant equipment', 'Log daily site safety log'],
          clientConfirmation: ['Deliver signed inspector punch list to general contractor', 'Update timeline in Project Manager workspace']
        },
        requiredTools: ['Digital laser measure', 'Code compliance manual', 'Torque wrench', 'GFCI outlet tester', 'Hard hat and steel boots'],
        safetyNotes: ['OSHA 1926 compliance strictly enforced: hard hats, high-vis, and eye protection required across jobsite', 'Lockout/tagout on live circuits'],
        troubleshootingNotes: ['If anchor bolts are misaligned in green concrete, consult structural engineer for approved epoxy dowel retrofit']
      }
    ]
  },
  {
    id: 'auto_services',
    name: 'Auto Services & Mobile Mechanics',
    description: 'Mobile mechanic, auto detailing, brake service, oil changes, and fleet maintenance.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Mobile Oil & Filter Change', 'Brake Pad & Rotor Replacement', 'Battery & Alternator Test', 'Full Mobile Detail', 'Fleet Multi-Point Inspection'],
    recommendedTone: 'Straightforward, trustworthy, precise, and mechanical',
    technicianRoleName: 'Certified Auto Mechanic',
    sampleJobPacks: [
      {
        id: 'jp_brake_service',
        serviceType: 'Brake Pad & Rotor Replacement',
        industry: 'auto_services',
        checklist: [
          'Test drive vehicle or inspect pedal feel and stopping distance',
          'Safely lift and secure vehicle on rated jack stands',
          'Measure rotor thickness with digital micrometer against minimum spec',
          'Inspect caliper slide pins, clean and lube with high-temp silicone grease',
          'Install ceramic brake pads with anti-rattle hardware clips',
          'Torque lug nuts with calibrated torque wrench to manufacturer specs'
        ],
        workflowSequence: {
          preCheck: ['Chock opposite wheels', 'Verify exact VIN and rotor/pad part numbers before disassembly'],
          execute: ['Wheel removal', 'Caliper compression and inspection', 'Rotor replacement', 'Hardware lubing and pad seating'],
          cleanUp: ['Pump brake pedal 4 times before moving vehicle', 'Wipe down greasy fingerprints from rim and door handle'],
          clientConfirmation: ['Perform 5-stop bedding procedure', 'Show customer old worn pads vs new installed pads']
        },
        requiredTools: ['3-ton hydraulic floor jack & rated stands', 'Torque wrench (ft-lbs)', 'Brake caliper piston compressor', 'Digital micrometer'],
        safetyNotes: ['Never rely solely on hydraulic jack; always use mechanical jack stands', 'Never blow brake dust with air hose; use brake cleaner wash'],
        troubleshootingNotes: ['If brake pedal feels spongy after installation, bleed fluid system to purge trapped air bubbles']
      }
    ]
  },
  {
    id: 'professional_services',
    name: 'Professional & Scientific Services',
    description: 'Consulting, engineering, research, design, and technical advisory firms.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Technical Feasibility Study', 'Operational Audit', 'Compliance Review', 'Implementation Roadmap', 'Executive Advisory Session'],
    recommendedTone: 'Formal, strategic, rigorous, and insight-driven',
    technicianRoleName: 'Senior Technical Consultant',
    sampleJobPacks: [
      {
        id: 'jp_operational_audit',
        serviceType: 'Operational Audit',
        industry: 'professional_services',
        checklist: [
          'Collect stakeholder input and standard operating procedures',
          'Map current workflow bottlenecks and error rates',
          'Conduct compliance alignment against ISO/industry benchmarks',
          'Model financial ROI and efficiency gains for proposed interventions',
          'Draft executive briefing deck with plain-language recommendations'
        ],
        workflowSequence: {
          preCheck: ['Execute mutual NDA', 'Access existing system telemetry and documentation'],
          execute: ['Stakeholder interviews', 'Data flow mapping', 'Gap analysis', 'Synthesis and roadmap drafting'],
          cleanUp: ['Sanitize and archive client raw interview notes', 'Review findings internally with Project Manager'],
          clientConfirmation: ['Deliver executive presentation to client leadership', 'Schedule 30-day implementation review checkpoint']
        },
        requiredTools: ['Process mapping software', 'Risk matrix framework', 'Cost-benefit financial model'],
        safetyNotes: ['Adhere strictly to client data privacy and non-disclosure standards', 'Enforce multi-factor authentication for data transfers'],
        troubleshootingNotes: ['If stakeholder metrics conflict, triangulate using raw timestamped log data']
      }
    ]
  },
  {
    id: 'real_estate',
    name: 'Real Estate & Property Management',
    description: 'Realtors, property managers, tenant turnovers, inspections, and staging.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Tenant Move-Out Inspection', 'Listing Prep Walkthrough', 'Rental Turnover Coordination', 'Routine Property Health Check', 'Lease Renewal Outreach'],
    recommendedTone: 'Responsive, professional, proactive, and polished',
    technicianRoleName: 'Property Inspector',
    sampleJobPacks: [
      {
        id: 'jp_turnover_inspection',
        serviceType: 'Tenant Move-Out Inspection',
        industry: 'real_estate',
        checklist: [
          'Test all smoke and carbon monoxide detectors with expiration dates',
          'Check under kitchen and bathroom sinks for moisture rings',
          'Inspect carpet stains and drywall scuffs against move-in condition report',
          'Test all appliances: stove burners, oven, refrigerator seal, dishwasher cycle',
          'Collect all keys, mailbox keys, and garage remotes'
        ],
        workflowSequence: {
          preCheck: ['Verify tenant forwarding address and utilities transfer status'],
          execute: ['Room-by-room photographic survey', 'Meter readings capture', 'Security deposit deduction tally'],
          cleanUp: ['Lock all windows, deadbolts, and adjust thermostat to eco-mode'],
          clientConfirmation: ['Email property owner itemized turnover punch list and cost estimate']
        },
        requiredTools: ['Inspection checklist tablet', 'Laser distance meter', 'Outlet GFCI tester', 'High-lumen flashlight'],
        safetyNotes: ['Verify building locks and ensure property is vacant before entering', 'Wear shoe covers on clean carpets'],
        troubleshootingNotes: ['If strong pet odor detected, schedule subfloor ozone treatment before new carpet installation']
      }
    ]
  },
  {
    id: 'general_small_business',
    name: 'General Small Business',
    description: 'Versatile operational framework adaptable to any local or service business.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Standard Service Appointment', 'Emergency Service Call', 'Consultation & Estimate', 'Maintenance Check', 'Follow-up Service'],
    recommendedTone: 'Clear, dependable, polite, and responsive',
    technicianRoleName: 'Service Specialist',
    sampleJobPacks: [
      {
        id: 'jp_standard_service',
        serviceType: 'Standard Service Appointment',
        industry: 'general_small_business',
        checklist: [
          'Review client request notes and history',
          'Perform on-site assessment and confirm scope with client',
          'Execute required service according to quality guidelines',
          'Conduct quality check and clean work area',
          'Collect client sign-off and trigger billing'
        ],
        workflowSequence: {
          preCheck: ['Confirm appointment time with client', 'Verify required parts and tools are loaded'],
          execute: ['On-site arrival notification', 'Service execution', 'Quality verification'],
          cleanUp: ['Remove all materials and wipe work surfaces', 'Confirm work area is spotless'],
          clientConfirmation: ['Obtain verbal or signed approval', 'Send digital completion summary']
        },
        requiredTools: ['Standard service kit', 'Mobile terminal', 'Digital receipt app'],
        safetyNotes: ['Follow general workplace safety rules', 'Maintain clear walkways and exits'],
        troubleshootingNotes: ['If client requests changes beyond original scope, note additional estimate before proceeding']
      }
    ]
  },
  {
    id: 'healthcare',
    name: 'Healthcare, Medical & Dental',
    description: 'Clinics, dental practices, physical therapy, home health, and wellness practices.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Patient Intake & Screening', 'Hygiene & Sterilization Audit', 'Appointment Reminders & Recalls', 'Insurance Verification', 'Patient Follow-up Care'],
    recommendedTone: 'Empathetic, reassuring, strictly confidential, and clinical',
    technicianRoleName: 'Clinical Coordinator',
    sampleJobPacks: [
      {
        id: 'jp_intake_screening',
        serviceType: 'Patient Intake & Screening',
        industry: 'healthcare',
        checklist: [
          'Verify patient demographic and insurance eligibility',
          'Review updated medical history and drug allergy flags',
          'Verify signed HIPAA privacy acknowledgments',
          'Sterilize patient operatory room and unseal sterile instrument cassette'
        ],
        workflowSequence: {
          preCheck: ['Confirm appointment 24 hours prior via SMS', 'Review chart alerts'],
          execute: ['Patient greeting & vitals check', 'Intake recording', 'Treatment setup'],
          cleanUp: ['Autoclave sterilization wipe-down', 'Sharps disposal in biohazard container'],
          clientConfirmation: ['Schedule next recall appointment', 'Send post-care instructions']
        },
        requiredTools: ['Sterilization autoclave', 'Digital charting system', 'Blood pressure monitor'],
        safetyNotes: ['Strict universal precautions: gloves, mask, eye protection', 'Protect patient PHI at all times'],
        troubleshootingNotes: ['If insurance benefits fail automated verification, call provider portal directly before appointment']
      }
    ]
  },
  {
    id: 'legal_accounting',
    name: 'Legal & Accounting Practices',
    description: 'Law firms, CPA practices, bookkeepers, and tax advisory services.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Client Intake & Conflict Check', 'Tax Document Preparation', 'Retainer Agreement Drafting', 'Quarterly Financial Review', 'Statutory Compliance Filing'],
    recommendedTone: 'Rigorous, ethical, confidential, and detail-oriented',
    technicianRoleName: 'Case / Account Specialist',
    sampleJobPacks: [
      {
        id: 'jp_client_intake_legal',
        serviceType: 'Client Intake & Conflict Check',
        industry: 'legal_accounting',
        checklist: [
          'Run conflict of interest check against all parties involved',
          'Collect identity verification documents',
          'Draft engagement letter and scope of representation',
          'Set up trust/retainer accounting ledger',
          'Establish secure client portal access'
        ],
        workflowSequence: {
          preCheck: ['Review prospective client inquiry', 'Execute conflict screening search'],
          execute: ['Engagement drafting', 'Retainer fee collection', 'File matter onboarding'],
          cleanUp: ['Archive conflict search clearance report in matter file'],
          clientConfirmation: ['Deliver signed retainer counter-copy and onboarding packet']
        },
        requiredTools: ['Conflict check database', 'Encrypted document portal', 'Trust accounting ledger'],
        safetyNotes: ['Strict compliance with ethical attorney-client / accountant privilege', 'Segregate trust funds from operating account immediately'],
        troubleshootingNotes: ['If conflict check returns related party match, escalate immediately to Executive Assistant for partner review']
      }
    ]
  },
  {
    id: 'restaurants',
    name: 'Restaurants & Food Service',
    description: 'Cafes, bistros, catering companies, ghost kitchens, and dining establishments.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Catering Package Proposal', 'Health Inspection Pre-Audit', 'Weekly Inventory & Supplier Order', 'Staff Shift Dispatch', 'VIP Guest Experience Follow-up'],
    recommendedTone: 'Hospitality-driven, appetizing, fast-paced, and food-safety focused',
    technicianRoleName: 'Kitchen / Ops Lead',
    sampleJobPacks: [
      {
        id: 'jp_health_preaudit',
        serviceType: 'Health Inspection Pre-Audit',
        industry: 'restaurants',
        checklist: [
          'Verify walk-in and low-boy refrigeration temps are under 40°F',
          'Check hot holding wells maintain minimum 135°F',
          'Inspect dish machine sanitizer concentration with test strips (50-100 ppm chlorine or 200 ppm quat)',
          'Check labeling and dating on all prepped food containers',
          'Ensure handwash sinks have hot water, soap, paper towels, and clean handwashing signs'
        ],
        workflowSequence: {
          preCheck: ['Calibrate food thermometers with ice bath', 'Review local health code checklist'],
          execute: ['Line walkthrough', 'Storage room check', 'Sanitizer test', 'Temperature log verification'],
          cleanUp: ['Dispose of any expired prepped goods immediately', 'Mop dry storage floors'],
          clientConfirmation: ['Sign off daily HACCP compliance sheet']
        },
        requiredTools: ['Thermocouple probe thermometer', 'Chemical sanitizer test strips', 'HACCP log tablet'],
        safetyNotes: ['Never cross-contaminate raw poultry with ready-to-eat foods', 'Maintain unobstructed access to kitchen handwash sinks'],
        troubleshootingNotes: ['If walk-in temperature creeps above 41°F, inspect evaporator coil for frost and call refrigeration technician immediately']
      }
    ]
  },
  {
    id: 'salons_spas',
    name: 'Salons, Spas & Personal Care',
    description: 'Hair salons, day spas, barbershops, nail studios, and aesthetic clinics.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['VIP Service Booking', 'Consultation & Skin/Hair Analysis', 'Station Disinfection & Sanitization', 'Package / Membership Sales', 'Post-Service Aftercare Check-in'],
    recommendedTone: 'Pampering, stylish, warm, and attentive',
    technicianRoleName: 'Senior Stylist / Aesthetician',
    sampleJobPacks: [
      {
        id: 'jp_station_sanitization',
        serviceType: 'Station Disinfection & Sanitization',
        industry: 'salons_spas',
        checklist: [
          'Submerge combs, shears, and guards in EPA-registered hospital grade disinfectant',
          'Wipe styling chair, shampoo bowl, and mirror with antibacterial solution',
          'Place clean, freshly laundered cape and towel at station',
          'Check client color formula or skin allergy history in client profile'
        ],
        workflowSequence: {
          preCheck: ['Send 2-hour appointment reminder text with parking info'],
          execute: ['Client consultation', 'Service execution', 'Homecare product recommendation'],
          cleanUp: ['Sweep hair cuttings immediately into dustpan', 'Sanitize station for next client'],
          clientConfirmation: ['Schedule 4-week rebooking before client leaves', 'Send automated aftercare text next morning']
        },
        requiredTools: ['Barbicide jar & solution', 'Autoclave/UV sterilizer', 'Styling station tools'],
        safetyNotes: ['Perform skin patch test 24 hours prior for clients receiving new chemical coloring or tint', 'Never use chipped or cracked glass tools'],
        troubleshootingNotes: ['If client experiences scalp redness, rinse immediately with cool water and apply soothing aloe emulsion']
      }
    ]
  },
  {
    id: 'retail_ecommerce',
    name: 'Retail & E-Commerce',
    description: 'Boutiques, local specialty stores, online sellers, and omnichannel merchants.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Order Fulfillment & Shipping', 'Product Return / Exchange', 'Inventory Reorder & Restock', 'Promotional Campaign Launch', 'Customer Review Request'],
    recommendedTone: 'Enthusiastic, helpful, prompt, and brand-forward',
    technicianRoleName: 'Fulfillment Specialist',
    sampleJobPacks: [
      {
        id: 'jp_order_fulfillment',
        serviceType: 'Order Fulfillment & Shipping',
        industry: 'retail_ecommerce',
        checklist: [
          'Pick items from warehouse/backroom matching order slip SKU and size',
          'Inspect merchandise for flaws, pulls, or manufacturing defects',
          'Wrap delicately with branded tissue and include thank-you note',
          'Weigh package on calibrated scale and print carrier shipping label',
          'Update tracking number in customer order management system'
        ],
        workflowSequence: {
          preCheck: ['Verify shipping address passes postal carrier validation'],
          execute: ['Accurate item pick', 'Quality inspection', 'Protective pack & label application'],
          cleanUp: ['Stack outgoing parcels in carrier pickup bin', 'Update inventory count'],
          clientConfirmation: ['Send customer tracking notification email with delivery estimate']
        },
        requiredTools: ['Thermal barcode label printer', 'Digital parcel scale', 'Handheld SKU scanner'],
        safetyNotes: ['Use box cutters with auto-retractable blades only', 'Lift heavy shipping boxes using leg muscles, not back'],
        troubleshootingNotes: ['If carrier marks address as undeliverable, send immediate customer SMS to verify apartment number']
      }
    ]
  },
  {
    id: 'nonprofits',
    name: 'Nonprofits & Community Organizations',
    description: 'Charities, community programs, foundations, and volunteer associations.',
    suggestedActiveEmployees: [
      'executive_assistant', 'sales', 'operations', 'customer_service',
      'technician', 'finance', 'admin', 'marketing', 'project_manager',
      'automation_specialist', 'hr', 'business_analyst'
    ],
    defaultServices: ['Donor Outreach & Stewardship', 'Volunteer Shift Coordination', 'Grant Proposal Tracking', 'Community Event Logistics', 'Impact Report Distribution'],
    recommendedTone: 'Purpose-driven, grateful, inspiring, and transparent',
    technicianRoleName: 'Program Coordinator',
    sampleJobPacks: [
      {
        id: 'jp_volunteer_coordination',
        serviceType: 'Volunteer Shift Coordination',
        industry: 'nonprofits',
        checklist: [
          'Confirm volunteer headcounts and shift roles 48 hours prior',
          'Prepare sign-in roster and safety liability waivers',
          'Set up orientation area with volunteer badges and task instructions',
          'Conduct 10-minute kickoff briefing and safety walkthrough',
          'Collect shift hours and issue appreciation certificates'
        ],
        workflowSequence: {
          preCheck: ['Send venue directions, parking details, and dress code to volunteers'],
          execute: ['Check-in & waiver signing', 'Mission kickoff briefing', 'Shift supervision'],
          cleanUp: ['Return supplies to storage bins', 'Tally total volunteer hours logged'],
          clientConfirmation: ['Send heartfelt thank-you email with group photo and impact metrics within 24 hours']
        },
        requiredTools: ['Tablet check-in app', 'First aid kit', 'Volunteer badges & lanyards'],
        safetyNotes: ['All volunteers must sign liability waivers and have emergency contacts on file', 'Ensure water and shaded rest breaks are provided'],
        troubleshootingNotes: ['If volunteer turnout is lower than expected, reassign participants to critical path tasks first']
      }
    ]
  }
];
