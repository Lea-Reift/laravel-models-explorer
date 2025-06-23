<?php

//Change Directory to workspace
chdir($argv[1]);

require_once __DIR__ . '/helpers.php';
$loader = require_once 'vendor/autoload.php';

//Bootstrap App
(require_once 'bootstrap/app.php')
    ->make(Illuminate\Contracts\Console\Kernel::class)
    ->bootstrap();

//Get project classes
$classes = $loader->getClassMap();

$composer = json_decode(file_get_contents("composer.json"), true);
$projectNamespaces = array_keys($composer['autoload']['psr-4']);

$projectClasses = array_filter($classes, mode: ARRAY_FILTER_USE_KEY, callback: function (string $class) use ($projectNamespaces) {
    foreach ($projectNamespaces as $namespace) if (str_starts_with($class, $namespace)) return true;
    return false;
});

//Filter models from classes
$models = array_filter(
    $projectClasses,
    mode: ARRAY_FILTER_USE_BOTH,
    callback: fn(string $file, string $class) =>
        is_string($class) &&
        is_string($file) &&
        class_extends_model($file, $class)
);

//Parse models into extension structure
$modelsInfo = array_map(array: array_keys($models), callback: fn(string $class) => parseModelInfo($class));

json_output($modelsInfo);
