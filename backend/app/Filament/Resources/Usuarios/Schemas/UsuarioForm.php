<?php

namespace App\Filament\Resources\Usuarios\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class UsuarioForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('nombre')
                    ->required(),
                Select::make('rol')
                    ->options([
                        'vendedor' => 'Vendedor',
                        'admin' => 'Administrador',
                    ])
                    ->required()
                    ->default('vendedor'),
                TextInput::make('pin')
                    ->label('PIN de acceso (app móvil)')
                    ->helperText('4 a 6 dígitos. El vendedor lo usa para entrar a la app.')
                    ->numeric()
                    ->minLength(4)
                    ->maxLength(6),
                Toggle::make('activo')
                    ->default(true)
                    ->required(),
            ]);
    }
}
