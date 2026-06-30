<?php

namespace App\Filament\Resources\Pedidos\Schemas;

use App\Models\Pedido;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;

class PedidoForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('cliente_id')
                    ->label('Cliente')
                    ->relationship('cliente', 'nombre')
                    ->searchable()
                    ->preload()
                    ->required(),
                Select::make('usuario_id')
                    ->label('Vendedor')
                    ->relationship('usuario', 'nombre'),
                DatePicker::make('fecha')
                    ->required(),
                Select::make('estado')
                    ->options(array_combine(Pedido::ESTADOS, Pedido::ESTADOS))
                    ->required()
                    ->default('borrador'),
                TextEntry::make('total')
                    ->label('Total (L)')
                    ->state(fn (?Pedido $record) => $record
                        ? number_format($record->totalNeto(), 2)
                        : '0.00')
                    ->weight('bold'),
                Textarea::make('nota')
                    ->columnSpanFull(),
            ]);
    }
}
