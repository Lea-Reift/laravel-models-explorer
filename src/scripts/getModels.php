<?php

//Change Directory to workspace
chdir($argv[1]);

require_once __DIR__.'/helpers.php';
$loader = require_once 'vendor/autoload.php';

//Get project classes
$classes = $loader->getClassMap();

//Bootstrap App
(require_once 'bootstrap/app.php')
    ->make(Illuminate\Contracts\Console\Kernel::class)
    ->bootstrap();

//Filter models from classes
$models = array_filter(
    $classes,
    mode: ARRAY_FILTER_USE_BOTH,
    callback: fn (string $file, string $class) => is_string($class) &&
        is_string($file) &&
        ! str_starts_with($class, 'Illuminate\\Database\\Eloquent') &&
        class_extends_model($file, $class)
);

//Parse models into extension structure
$modelsInfo = array_map(array: array_keys($models), callback: fn (string $class) => parseModelInfo($class));

json_output($modelsInfo);
