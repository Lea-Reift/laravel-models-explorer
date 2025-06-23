<?php

use Illuminate\Database\Eloquent\Model;

function json_output(mixed $data): never
{
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit(0);
}

if (! function_exists('array_find')) {
    function array_find(array $array, callable $callback, string $use = 'BOTH'): mixed
    {
        if (! in_array($use, ['KEY', 'VALUE', 'BOTH'])) {
            throw new InvalidArgumentException("Invalid use {$use} in array_find");
        }

        foreach ($array as $key => $value) {
            switch ($use) {
                case 'KEY':
                    if ($callback($key)) {
                        return $value;
                    }
                    break;
                case 'VALUE':
                    if ($callback($value)) {
                        return $value;
                    }
                    break;
                default:
                    if ($callback($value, $key)) {
                        return $value;
                    }
                    break;
            }
        }

        return null;
    }
}

function array_group_by(array $array, string|callable $groupBy)
{
    $result = [];

    foreach ($array as $key => $value) {
        $groupByKey = is_callable($groupBy) ? $groupBy($value, $key) : $groupBy;
        $result[$groupByKey][] = $value;
    }

    return $result;
}

function class_extends_model(string $file, string $expectedClass): bool
{
    if (! is_file($file)) {
        return false;
    }
    $code = file_get_contents($file);
    if ($code === false) {
        return false;
    }

    $tokens = PhpToken::tokenize($code);

    $namespace = array_find($tokens, use: 'KEY', callback: fn (int $key) => ($tokens[$key - 2] ?? null)?->is(T_NAMESPACE))?->text;
    $currentClass = array_find($tokens, use: 'KEY', callback: fn (int $key) => ($tokens[$key - 2] ?? null)?->is(T_CLASS))?->text;
    $extends = array_find($tokens, use: 'KEY', callback: fn (int $key) => ($tokens[$key - 2] ?? null)?->is(T_EXTENDS))?->text;

    $fqcn = $namespace ? "$namespace\\$currentClass" : $currentClass;

    if ($fqcn !== $expectedClass) {
        return false;
    }

    $baseModel = Model::class;

    $tokensByLine = array_group_by($tokens, fn (PhpToken $token) => $token->line);
    $importsLines = array_filter($tokensByLine, fn (array $tokens) => $tokens[0]->is(T_USE));

    $imports = array_map(fn (array $tokens) => $tokens[2]->text, $importsLines);

    return (in_array($baseModel, $imports) && $extends === 'Model') || $extends === $baseModel;

    return false;
}

function parseModelRelations(Model $model): array
{
    $reflection = new ReflectionClass($model);

    $methods = $reflection->getMethods(ReflectionMethod::IS_PUBLIC);
    $relations = [];

    foreach ($methods as $method) {
        $type = null;
        if ($method->class !== get_class($model)) {
            continue;
        }

        if ($method->getNumberOfParameters() > 0) {
            continue;
        }

        if (! $method->hasReturnType() || $method->getReturnType()->isBuiltin()) {
            $docComment = $method->getDocComment();
            if ($docComment === false) {
                continue;
            }

            if (! preg_match('/@return\s+(?<type>[^\s]+)/', $docComment, $match)) {
                continue;
            }

            $type = $match['type'];
        }

        $type ??= $method->getReturnType()->getName();

        if (! is_subclass_of($type, Illuminate\Database\Eloquent\Relations\Relation::class)) {
            continue;
        }

        $relation = $method->invoke($model);

        $relations[] = [
            'name' => $method->getName(),
            'type' => basename($relation::class),
            'relatedModel' => get_class($relation->getRelated()),
        ];
    }

    return $relations;
}

function parseModelInfo(string $modelClass): array
{
    $model = new $modelClass();

    $reflection = new ReflectionClass($model);

    return [
        'name' => $reflection->getShortName(),
        'namespace' => $reflection->getNamespaceName(),
        'table' => $model->getTable(),
        'fillable' => $model->getFillable(),
        'hidden' => $model->getHidden(),
        'casts' => $model->getCasts(),
        'relationships' => parseModelRelations($model),
        'traits' => $reflection->getTraitNames(),
        'uri' => $reflection->getFileName(),
    ];
}
