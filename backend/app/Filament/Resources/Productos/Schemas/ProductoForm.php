<?php

namespace App\Filament\Resources\Productos\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class ProductoForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Textarea::make('nombre')
                    ->required()
                    ->columnSpanFull(),
                TextInput::make('orden')
                    ->required()
                    ->numeric()
                    ->default(0),
                Toggle::make('activo')
                    ->required(),
                Textarea::make('legacy_identificador')
                    ->columnSpanFull(),
                DateTimePicker::make('last_modified')
                    ->required(),
            ]);
    }
}
