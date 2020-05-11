var relax_scenarios = {
    "MC" : {
        "const":{
            "sim_type" : {"val":"MC"},
            "backend" :  {"val":"CPU"},
            "T_units":   {"val":"C"},
            //"list_type" : {"val":"cell"},
            "ensemble" : {"val":"NVT"},
            "verlet_skin" : {"val":0.5},
            "time_scale" : {"val":"linear"},
            "restart_step_counter" : {"val":1}
            
        },
        "var" :{
            "T" : {
                "val":20, 
                "id" :"mcT"
            },
            "steps" : {
                "val":100000,
                "id" :"mcSteps"
            },
            "salt_concentration" : {
                "val": 1,
                "id" : "mcSalt" 
            },
            "interaction_type" : {
                "val": "DNA_relax",
                "id" : "mcInteractionType"
            },
            "relax_type": {
                "val": "harmonic_force",
                "id" : "mcRelaxType"
            },
            "print_conf_interval" : {
                "val": 50000,
                "id" : "mcPrintConfInterval"
            },
            "print_energy_every" : {
                "val":50000,
                "id" : "mcPrintEnergyInterval"
            }, 
            "delta_translation" : {
                "val":0.02,
                "id" : "mcDeltaTranslation"
            }, 
            "delta_rotation" : {
                "val":0.04,
                "id" : "mcDeltaRotation"
            }
        }
    },
    "MD_GPU" : {
        "const":{
            "sim_type" : {"val":"MD"},
            "T_units":   {"val":"C"},
            "backend" :  {"val":"CUDA"},
            "backend_precision" : {"val":"mixed"},
            "max_density_multiplier" : {"val":10},
            "max_backbone_force" : {"val": 5},
            "max_backbone_force_far" : {"val":10},
            "time_scale" : {"val":"linear"},
            "verlet_skin" : {"val":0.5},
            "seq_dep_file" : {"val":"oxDNA2_sequence_dependent_parameters.txt"},
            "refresh_vel" : {"val":1},
            "CUDA_list" : {"val":"verlet"},
            "restart_step_counter" : {"val":1},
            "newtonian_steps" : {"val":103},
            "CUDA_sort_every" : {"val":0},
            "use_edge" : {"val":1},
            "edge_n_forces" : {"val":1},
            "cells_auto_optimisation" : {"val":"true"},
            "reset_com_momentum" : {"val":"true"}
        },


        "var":{
            "T": {
                "val":20, 
                "id" :"mdT"
            },
            "steps" : {
                "val":1000000, 
                "id" :"mdSteps"
            },
            "salt_concentration" : {
                "val":1, 
                "id" :"mdSalt"
            },
            "interaction_type" : {
                "val":"DNA2", 
                "id" :"mdInteractionType"
            },
            "print_conf_interval" : {
                "val":50000,
                "id" :"mdPrintConfInterval"
            },
            "print_energy_every" : {
                "val":50000, 
                "id" :"mdPrintEnergyInterval"
            },
            "thermostat" : {
                "val":"john", 
                "id" :"mdThermostat"
            },
            "dt" : {
                "val":0.005, 
                "id" :"mdDT"
            },
            "diff_coeff" : {
                "val":2.5, 
                "id" :"mdDiff_Coeff"
            }
        }
    }
};
